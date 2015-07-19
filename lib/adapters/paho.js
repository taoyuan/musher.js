"use strict";
var Emitter = require('../emitter');

var defaultPort = 3883;
var defaultSecurePort = 4883;

/**
 * http://git.eclipse.org/c/paho/org.eclipse.paho.mqtt.javascript.git/tree/src/mqttws31.js
 */

exports.initialize = function initialize(socket, utils) {
    var settings = socket.settings || {};

    var options = {};
    options.clientId = settings.clientId || utils.makeId();
    options.userName = settings.username || settings.key;
    options.password = settings.password || settings.secret;
    options.useSSL = !!settings.useSSL;
    options.port = Number(settings.port || (settings.useSSL ? defaultSecurePort : defaultPort));
    options.host = settings.host || defaultHost;
    merge(options, settings.options);

    var client = socket.client = new Messaging.Client(options.host, options.port, options.clientId);
    socket.adapter = new Paho(client, options);
};

function Paho(client, options) {
    this.client = client;

    var adapter = this;
    client.onConnectionLost = function () {
        adapter.emit('close');
    };
    client.onMessageArrived = function (message) {
        adapter.emit('message', message.destinationName, message.payloadString);
    };

    options = options || {};
    options.onSuccess = function onConnected() {
        adapter.emit('connect');
    };

    client.connect(options);
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
