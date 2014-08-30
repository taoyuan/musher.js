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