(function (define) {
    "use strict";

    define(function () {

        /**
         * http://git.eclipse.org/c/paho/org.eclipse.paho.mqtt.javascript.git/tree/src/mqttws31.js
         */

        function initialize(socket, utils) {
            var settings = socket.settings || {};

            var port = Number(settings.port || 1883);
            var host = settings.host || '127.0.0.1';
            var clientId = settings.clientId || utils.makeId();

            var client = socket.client = new Messaging.Client(host, port, clientId);

            client.onConnectionLost = function () {
                socket._disconnected();
            };
            client.onMessageArrived = function (message) {
                socket._message(message.destinationName, message.payloadString);
            };

            function onConnected() {
                socket._connected();
            }

            var connectOptions = utils.assign({ onSuccess: onConnected }, settings.options);
            client.connect(connectOptions);

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