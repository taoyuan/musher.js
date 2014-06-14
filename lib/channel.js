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

        return Channel;
    });
})(typeof define === 'function' && define.amd ? define : function (factory) {
    module.exports = factory(require);
});