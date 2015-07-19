"use strict";
var merge = require('util-merge');
var Emitter = require('../emitter');

var defaultPort = 3883;
var defaultSecurePort = 4883;

/**
 * http://git.eclipse.org/c/paho/org.eclipse.paho.mqtt.javascript.git/tree/src/mqttws31.js
 */

exports.initialize = function initialize(socket, utils) {
    var settings = socket.settings || {};

    var host = settings.options.host || settings.host || defaultHost;
    var port = Number(settings.options.port || settings.port || (settings.useSSL ? defaultSecurePort : defaultPort));
    var clientId = settings.options.clientId || settings.clientId || utils.makeId();

    var options = {};
    options.userName = settings.username || settings.key;
    options.password = settings.password || settings.secret;
    options.useSSL = !!settings.useSSL;

    merge(options, settings.options);
    merge(settings, options); // update settings

    delete options.host;
    delete options.port;
    delete options.clientId;

    Object.keys(options).forEach(function(key) {
        if (options[key] === null || options[key] === undefined) {
            delete options[key];
        }
    });

    var client = socket.client = new Messaging.Client(host, port, clientId);
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
