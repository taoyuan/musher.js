(function (define) {
    "use strict";

    define(function (require) {

        var debug = require('debug')('musher:socket');
        var utils = require('./utils');
        var Emitter = require('./emitter');
        var Channels = require('./channels');

        var defaultHost = 'musher.io';

        function Socket(adapter, opts) {
            if (!(this instanceof Socket)) {
                return new Socket(adapter, opts);
            }

            // just save everything we get
            var settings = this.settings = utils.assign({ host: defaultHost }, opts);
            this.key = settings.key;
            this.prefix = this.key ? '$' + this.key + ':' : null;

            var useSSL = settings.ssl || settings.secure;
            if (useSSL !== null && useSSL !== undefined) {
                settings.useSSL = !!useSSL;
            }
            settings.options = settings.options || {};

            this.queue = [];

            // initialize adapter
            adapter.initialize(this, utils);

            // we have an adapter now?
            if (!this.adapter) {
                throw new Error('Adapter is not defined correctly: it should create `adapter` member of socket');
            }

            this.channels = new Channels(this);

            var socket = this;
            this.adapter.on('error', function () {
                socket.emit('error')
            });
            this.adapter.on('connect', function () {
                socket._connected();
            });
            this.adapter.on('close', function () {
                socket._close();
            });
            this.adapter.on('message', function (topic, message, packet) {
                socket._message(topic, message);
            });
        }

        Emitter.extend(Socket);

        Socket.prototype.__defineGetter__('connected', function () {
            return this.adapter.connected;
        });

        Socket.prototype._connected = function () {
            for (var i = 0; i < this.queue.length; i++) {
                this.queue[i]();
            }
            this.queue = [];
            this.emit('connected');
        };

        Socket.prototype._close = function () {
            this.emit('close');
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
            return this.prefix && cname.indexOf(this.prefix) !== 0 ? this.prefix + cname : cname;
        };

        Socket.prototype._decode = function (topic) {
            return this.prefix && topic.indexOf(this.prefix) === 0 ? topic.substring(this.prefix.length) : topic;
        };

        Socket.prototype.close = function (cb) {
            if (cb) this.once('close', cb);
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
            var socket = this;
            if (!socket.connected) {
                this._enqueue(function () {
                    socket._publish(cname, event, data);
                });
            } else {
                socket._publish(cname, event, data);
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