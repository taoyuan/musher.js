"use strict";
var Emitter = require('../emitter');

var defaultPort = 3883;
var defaultSecurePort = 4883;

/**
 * http://git.eclipse.org/c/paho/org.eclipse.paho.mqtt.javascript.git/tree/src/mqttws31.js
 */

exports.initialize = function initialize(socket, utils) {
    var settings = socket.settings || {};
    var opts = settings.options || {};

    var clientId = settings.clientId || utils.makeId();

    if (settings.key) opts.userName = settings.key;
    if (settings.secret) opts.password = settings.secret;

    if ('useSSL' in settings) {
        opts.useSSL = settings.useSSL;
    }

    settings.port = Number(settings.port || (opts.useSSL ? defaultSecurePort : defaultPort));

    var client = socket.client = new Messaging.Client(settings.host, settings.port, clientId);
    socket.adapter = new Paho(client, opts);
}

function Paho(client, opts) {
    this.client = client;

    var adapter = this;
    client.onConnectionLost = function () {
        adapter.emit('close');
    };
    client.onMessageArrived = function (message) {
        adapter.emit('message', message.destinationName, message.payloadString);
    };

    opts = opts || {};
    opts.onSuccess = function onConnected() {
        adapter.emit('connect');
    };

    client.connect(opts);
}

Emitter.extend(Paho);

Paho.prototype.__defineGetter__('connected', function () {
    return this.client.connected;
});

Paho.prototype.subscribe = function (topic, opts, cb) {
    opts = opts || {};
    if (cb) opts.onSuccess = cb;
    return this.client.subscribe(topic, opts);
};

Paho.prototype.unsubscribe = function (topic, opts, cb) {
    opts = opts || {};
    if (cb) opts.onSuccess = cb;
    return this.client.unsubscribe(topic, opts);
};

Paho.prototype.publish = function (topic, message) {
    var m = new Messaging.Message(message);
    m.destinationName = topic;
    return this.client.send(m);
};

Paho.prototype.close = function () {
    return this.client.disconnect();
};
