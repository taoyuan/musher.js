(function (define) {
    "use strict";

    define(function (require) {

        var utils = require('./utils');
        var Emitter = require('./emitter');
        var Channels = require('./channels');
        var defaults = require('./defaults')();

        function Socket(adapter, settings) {
            if (!(this instanceof Socket)) {
                return new Socket(adapter, settings);
            }

            var self = this;

            // just save everything we get
            this.settings = settings = utils.assign({}, defaults, settings);
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

        Socket.prototype.channel = function (cnameOrTopic) {
            return this.channels.channel(cnameOrTopic);
        };

        Socket.prototype.subscribe = function (cname, options, cb) {
            if (typeof options === "function") {
                cb = options;
                options = null;
            }
            var channel = this.channels.add(cname, options, this);
            if (channel.connected) {
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