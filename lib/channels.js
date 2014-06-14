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