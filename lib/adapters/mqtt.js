(function (define) {
    "use strict";

    define(function (require) {

        var mqtt = require('mqtt');

        function initialize(socket, utils) {
            var settings = utils.assign({
                port: 1883,
                host: 'localhost'
            }, socket.settings);

            var options = utils.assign({
                clientId: utils.makeId()
            }, settings.options);

            var client;
            if (settings.useSSL) {
                client = mqtt.createSecureClient(settings.port, settings.host, options);
            } else {
                client = mqtt.createClient(settings.port, settings.host, options);
            }
            client.on('error', socket.emit.bind(socket, 'error'));
            client.on('connect', function () {
                socket._connected();
            });
            client.on('close', function () {
                socket._disconnected();
            });
            client.on('message', function (cname, message, packet) {
                socket._message(cname, message);
            });

            socket.client = client;
            socket.adapter = new Mqtt(client);
        }

        function Mqtt(client) {
            this.client = client;
        }

        Mqtt.prototype.subscribe = function (cname, options, callback) {
            return this.client.subscribe(cname, options, callback);
        };

        Mqtt.prototype.unsubscribe = function (cname, options, cb) {
            return this.client.unsubscribe(cname, cb);
        };

        Mqtt.prototype.publish = function (cname, message) {
            this.client.publish(cname, message);
        };

        Mqtt.prototype.close = function () {
            return this.client.end();
        };

        return {
            initialize: initialize
        };

    });

})(typeof define === 'function' && define.amd ? define : function (factory) {
    module.exports = factory(require);
});