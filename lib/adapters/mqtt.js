(function (define) {
    "use strict";

    define(function (require) {

        var mqtt = require('mqtt');

        var defaultPort = 1883;
        var defaultSecurePort = 2883;

        function initialize(socket, utils) {
            var settings = socket.settings || {};

            var options = settings.options = settings.options || {};
            options.clientId = settings.clientId || utils.makeId();
            if (settings.key) options.username = settings.key;
            if (settings.secret) options.password = settings.secret;

            var client;
            if (settings.useSSL) {
                settings.port = Number(settings.port || defaultSecurePort);
                client = mqtt.createSecureClient(settings.port, settings.host, options);
            } else {
                settings.port = Number(settings.port || defaultPort);
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