/***********************************************
* Musher Javascript and Node.js Library v0.1.0
* https://github.com/taoyuan/musher
* 
* Copyright (c) 2014 Tao Yuan.
* Licensed MIT 
* 
* Date: 2014-08-30 17:43
***********************************************/
!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.musher=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (define) {
    "use strict";

    define(function () {

        var defaultPort = 3883;
        var defaultSecurePort = 4883;

        /**
         * http://git.eclipse.org/c/paho/org.eclipse.paho.mqtt.javascript.git/tree/src/mqttws31.js
         */

        function initialize(socket, utils) {
            var settings = socket.settings || {};
            var options = settings.options || {};

            var clientId = settings.clientId || utils.makeId();

            if (settings.key) options.userName = settings.key;
            if (settings.secret) options.password = settings.secret;

            var opts = utils.assign({ onSuccess: onConnected }, options);
            if ('useSSL' in settings) {
                opts.useSSL = settings.useSSL;
            }

            settings.port = Number(settings.port || (opts.useSSL ? defaultSecurePort: defaultPort));

            var client = socket.client = new Messaging.Client(settings.host, settings.port, clientId);

            client.onConnectionLost = function () {
                socket._disconnected();
            };
            client.onMessageArrived = function (message) {
                socket._message(message.destinationName, message.payloadString);
            };

            function onConnected() {
                socket._connected();
            }

            client.connect(opts);

            socket.adapter = new Paho(client);
        }

        function Paho(client) {
            this.client = client;
        }

        Paho.prototype.subscribe = function (cname, options, cb) {
            var opts = options || {};
            if (cb) opts.onSuccess = cb;
            return this.client.subscribe(cname, opts);
        };

        Paho.prototype.unsubscribe = function (cname, options, cb) {
            var opts = options || {};
            if (cb) opts.onSuccess = cb;
            return this.client.unsubscribe(cname, opts);
        };

        Paho.prototype.publish = function (cname, message) {
            var m = new Messaging.Message(message);
            m.destinationName = cname;
            return this.client.send(m);
        };

        Paho.prototype.close = function () {
            return this.client.disconnect();
        };

        return {
            initialize: initialize
        };
    });

})(typeof define === 'function' && define.amd ? define : function (factory) {
    module.exports = factory(require);
});
},{}],2:[function(require,module,exports){
(function (define) {
    "use strict";

    define(function (require) {

        var Emitter = require('./emitter');

        function Channel(name, options, socket) {
            if (!(this instanceof Channel)) {
                return new Channel(name, options, socket);
            }
            this.socket = socket;
            this.key = socket.key;
            this.adapter = socket.adapter;
            this.name = name;
            this.options = options;
            this.topic = socket._encode(this.name);
        }

        Emitter.extend(Channel);

        Channel.prototype.bind = Channel.prototype.on;

        Channel.prototype.subscribe = function (cb) {
            var self = this;
            this.adapter.subscribe(this.topic, this.options, function (err) {
                if (cb) cb.call(self, err, self);
            });
            return this;
        };

        /**
         * unsubscribe - unsubscribe from channel
         *
         * @param {Function} [cb] - callback fired on unsuback
         * @returns {Channel} this - for chaining
         * @example channel.unsubscribe('topic');
         * @example channel.unsubscribe('topic', console.log);
         */
        Channel.prototype.unsubscribe = function (cb) {
            this.adapter.unsubscribe(this.topic, {}, cb);
            return this;
        };

        Channel.prototype.__handleMessage = function (message) {
            message = JSON.parse(message);
            if (message.__event__ && message.__data__) {
                this.emit(message.__event__, message.__data__);
            }
        };

        /**
         * Convenience method for publish through channel.
         *
         * @param event
         * @param data
         */
        Channel.prototype.publish = function (event, data) {
            this.socket.publish(this.name, event, data);
        };

        return Channel;
    });
})(typeof define === 'function' && define.amd ? define : function (factory) {
    module.exports = factory(require);
});
},{"./emitter":4}],3:[function(require,module,exports){
(function (define) {
    "use strict";

    define(function (require) {

        var Channel = require('./channel');
        var utils = require('./utils');

        function Channels(socket) {
            this.socket = socket;
            this.key = socket.key;
            this.adapter = socket.adapter;
            this._channels = {};
        }

        Channels.prototype.add = function (cname, options, socket) {
            return utils.sure(this._channels, cname, function () {
                return createChannel(cname, options, socket);
            });
        };

        Channels.prototype.remove = function (cname) {
            var channel = this._channels[cname];
            delete this._channels[cname];
            return channel;
        };

        Channels.prototype.channel = function (cnameOrTopic) {
            return this._channels[this.socket._decode(cnameOrTopic)];
        };

        Channels.prototype.unsubscribeAll = function (cb) {
            if (!this.channels) return cb();
            var invokers = [];
            utils.each(this.channels, function (channel) {
                invokers.push(channel.unsubscribe.bind(channel));
            });
            return utils.parallel(invokers, cb);
        };

        function createChannel(name, options, socket) {
            return new Channel(name, options, socket);
        }

        return Channels;
    });
})(typeof define === 'function' && define.amd ? define : function (factory) {
    module.exports = factory(require);
});
},{"./channel":2,"./utils":6}],4:[function(require,module,exports){
(function (define) {
    "use strict";

    define(function (require) {

        var utils = require('./utils');

        function Emitter() {
        }

        /**
         * Mixin the emitter properties.
         *
         * @param {Object} obj
         * @return {Object}
         * @api private
         */

        Emitter.mixin = function(obj) {
            utils.assign(obj, Emitter.prototype);
            return obj;
        };

        Emitter.extend = function(obj) {
            utils.assign(obj.prototype, Emitter.prototype);
            return obj;
        };

        /**
         * Listen on the given `event` with `fn`.
         *
         * @param {String} event
         * @param {Function} fn
         * @return {Emitter}
         * @api public
         */

        Emitter.prototype.on =
            Emitter.prototype.addEventListener = function (event, fn) {
                this._callbacks = this._callbacks || {};
                (this._callbacks[event] = this._callbacks[event] || [])
                    .push(fn);
                return this;
            };

        /**
         * Adds an `event` listener that will be invoked a single
         * time then automatically removed.
         *
         * @param {String} event
         * @param {Function} fn
         * @return {Emitter}
         * @api public
         */

        Emitter.prototype.once = function (event, fn) {
            var self = this;
            this._callbacks = this._callbacks || {};

            function on() {
                self.off(event, on);
                fn.apply(this, arguments);
            }

            on.fn = fn;
            this.on(event, on);
            return this;
        };

        /**
         * Remove the given callback for `event` or all
         * registered callbacks.
         *
         * @param {String} event
         * @param {Function} fn
         * @return {Emitter}
         * @api public
         */

        Emitter.prototype.off =
            Emitter.prototype.removeListener =
                Emitter.prototype.removeAllListeners =
                    Emitter.prototype.removeEventListener = function (event, fn) {
                        this._callbacks = this._callbacks || {};

                        // all
                        if (0 == arguments.length) {
                            this._callbacks = {};
                            return this;
                        }

                        // specific event
                        var callbacks = this._callbacks[event];
                        if (!callbacks) return this;

                        // remove all handlers
                        if (1 == arguments.length) {
                            delete this._callbacks[event];
                            return this;
                        }

                        // remove specific handler
                        var cb;
                        for (var i = 0; i < callbacks.length; i++) {
                            cb = callbacks[i];
                            if (cb === fn || cb.fn === fn) {
                                callbacks.splice(i, 1);
                                break;
                            }
                        }
                        return this;
                    };

        /**
         * Emit `event` with the given args.
         *
         * @param {String} event
         * @param {Mixed} ...
         * @return {Emitter}
         */

        Emitter.prototype.emit = function (event) {
            this._callbacks = this._callbacks || {};
            var args = [].slice.call(arguments, 1)
                , callbacks = this._callbacks[event];

            if (callbacks) {
                callbacks = callbacks.slice(0);
                for (var i = 0, len = callbacks.length; i < len; ++i) {
                    callbacks[i].apply(this, args);
                }
            }

            return this;
        };

        /**
         * Return array of callbacks for `event`.
         *
         * @param {String} event
         * @return {Array}
         * @api public
         */

        Emitter.prototype.listeners = function (event) {
            this._callbacks = this._callbacks || {};
            return this._callbacks[event] || [];
        };

        /**
         * Check if this emitter has `event` handlers.
         *
         * @param {String} event
         * @return {Boolean}
         * @api public
         */

        Emitter.prototype.hasListeners = function (event) {
            return !!this.listeners(event).length;
        };

        return Emitter;

    });

})(typeof define === 'function' && define.amd ? define : function (factory) {
    module.exports = factory(require);
});
},{"./utils":6}],5:[function(require,module,exports){
(function (define) {
    "use strict";

    define(function (require) {

        var utils = require('./utils');
        var Emitter = require('./emitter');
        var Channels = require('./channels');

        var defaultHost = 'musher.io';

        function Socket(adapter, opts) {
            if (!(this instanceof Socket)) {
                return new Socket(adapter, opts);
            }

            var self = this;

            // just save everything we get
            var settings = this.settings = utils.assign({ host: defaultHost }, opts);
            this.key = settings.key;
            this.topicKey = this.key ? '$' + this.key + ':' : null;

            var useSSL = settings.ssl || settings.secure;
            if (useSSL !== null && useSSL !== undefined) {
                settings.useSSL = !!useSSL;
            }
            settings.options = settings.options || {};

            this.queue = [];

            // initialize adapter
            adapter.initialize(self, utils);

            // we have an adapter now?
            if (!self.adapter) {
                throw new Error('Adapter is not defined correctly: it should create `adapter` member of socket');
            }

            self.channels = new Channels(this);
        }

        Emitter.extend(Socket);

        Socket.prototype._connected = function () {
            this.connected = true;
            for (var i = 0; i < this.queue.length; i++) {
                this.queue[i]();
            }
            this.queue = [];
            this.emit('connected');
        };

        Socket.prototype._disconnected = function () {
            this.connected = false;
            this.emit('disconnected');
        };

        Socket.prototype._enqueue = function (fn) {
            this.queue.push(fn);
        };

        Socket.prototype._message = function (topic, message) {
            var c = this.channel(topic);
            if (c) {
                c.__handleMessage(message);
            } else {
                throw new Error('No channel to handle message with topic [' + topic + ']');
            }
        };

        Socket.prototype._encode = function (cname) {
            return this.topicKey && cname.indexOf(this.topicKey) != 0 ? this.topicKey + cname : cname;
        };

        Socket.prototype._decode = function (topic) {
            return this.topicKey && topic.indexOf(this.topicKey) == 0 ? topic.substring(this.topicKey.length) : topic;
        };

        Socket.prototype.close = function (cb) {
            if (cb) this.once('disconnected', cb);
            this.adapter.close();
        };

        Socket.prototype.channel = function (nameOrTopic) {
            return this.channels.channel(nameOrTopic);
        };

        Socket.prototype.subscribe = function (cname, options, cb) {
            if (typeof options === "function") {
                cb = options;
                options = null;
            }
            var channel = this.channels.add(cname, options, this);
            if (this.connected) {
                channel.subscribe(cb);
            } else {
                this._enqueue(function () {
                    channel.subscribe(cb);
                });
            }
            return channel;
        };

        Socket.prototype.unsubscribe = function (cname, cb) {
            cb = cb || utils.nop;
            var channel = this.channels.remove(cname, cb);
            if (channel.connected) {
                channel.unsubscribe(cb);
            } else {
                cb();
            }
            return this;
        };

        Socket.prototype.publish = function (cname, event, data) {
            var self = this;
            if (!self.connected) {
                this._enqueue(function () {
                    self._publish(cname, event, data);
                });
            } else {
                self._publish(cname, event, data);
            }

            return this;
        };

        Socket.prototype._publish = function (cname, event, data) {
            var message = JSON.stringify({__event__: event, __data__: data});
            this.adapter.publish(this._encode(cname), message);
        };

        Socket.defaults = function (settings) {
            utils.assign(defaults, settings);
        };

        return Socket;
    });
})(typeof define === 'function' && define.amd ? define : function (factory) {
    module.exports = factory(require);
});
},{"./channels":3,"./emitter":4,"./utils":6}],6:[function(require,module,exports){
(function (define) {
    "use strict";

    define(function () {

        var breaker = {};

        var ArrayProto = Array.prototype;

        var nativeForEach = ArrayProto.forEach;
        var slice = ArrayProto.slice;

        return {
            nop: nop,
            each: forEach,
            forEach: forEach,
            assign: assign,
            parallel: parallel,
            sure: sure,
            makeId: makeId,
            parseAuthOptions: parseAuthOptions
        };

        function nop() {
        }

        function forEach(obj, iterator, context) {
            if (obj == null) return;
            if (nativeForEach && obj.forEach === nativeForEach) {
                obj.forEach(iterator, context);
            } else if (obj.length === +obj.length) {
                for (var i = 0, length = obj.length; i < length; i++) {
                    if (iterator.call(context, obj[i], i, obj) === breaker) return;
                }
            } else {
                var keys = obj.keys;
                for (var i = 0, length = keys.length; i < length; i++) {
                    if (iterator.call(context, obj[keys[i]], keys[i], obj) === breaker) return;
                }
            }
        }


        function assign(obj) {
            forEach(slice.call(arguments, 1), function (source) {
                if (source) {
                    for (var prop in source) {
                        obj[prop] = source[prop];
                    }
                }
            });
            return obj;
        }

        function parallel(tasks, callback) {
            var results = [], count = tasks.length;
            tasks.forEach(function (task, index) {
                task(function (err, data) {
                    results[index] = data;
                    if (err) {
                        callback(err);
                        callback = null;
                    }
                    if (--count === 0 && callback) {
                        callback(null, results);
                    }
                });
            });
        }

        function sure(obj, key, value) {
            var v = obj[key];
            return v ? v : obj[key] = (typeof value === 'function' ? value.call(obj) : value);
        }

        function makeId(prefix) {
            var i, possible, text;
            text = "";
            possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
            for (i = 0; i < 5; i++) {
                text += possible.charAt(Math.floor(Math.random() * possible.length));
            }
            return (prefix ? prefix :'musher-') + text;
        }

        function parseAuthOptions(auth, opts) {
            if(auth){
                if (auth.key) {
                    opts.username = auth.key;
                }
                if (auth.secret) {
                    opts.password = auth.secret;
                }
            }
        }

    });

})(typeof define === 'function' && define.amd ? define : function (factory) {
    module.exports = factory(require);
});
},{}],7:[function(require,module,exports){
var Socket = require('../lib/socket');

exports.connect = function (key, settings) {
    if (typeof key === 'object') {
        settings = key;
        key = null;
    }
    settings = settings || {};
    if (key) settings.key = key;
    return new Socket(require('../lib/adapters/paho'), settings);
};

exports.Socket = Socket;
exports.utils = require('../lib/utils');

},{"../lib/adapters/paho":1,"../lib/socket":5,"../lib/utils":6}]},{},[7])(7)
});