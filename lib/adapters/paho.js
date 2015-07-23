"use strict";
var merge = require('utils-merge');
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

    if (options.userName && !options.password) delete options.userName;

    var client = socket.client = new Paho.MQTT.Client(host, port, clientId);
    socket.adapter = new PahoAdapter(client, options);
};

function PahoAdapter(client, options) {
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
    options.onFailure = function (message) {
        adapter.emit(new Error(message.errorMessage));
    };

    client.connect(options);
}

Emitter.extend(PahoAdapter);

PahoAdapter.prototype.__defineGetter__('connected', function () {
    return this.client.connected;
});

PahoAdapter.prototype.subscribe = function (topic, opts, cb) {
    opts = opts || {qos: 1};
    cb = cb || function () {};
    opts.onSuccess = function (messsage) {
        cb(null, messsage.grantedQos);
    };
    opts.onFailure = function (messsage) {
        cb(messsage.errorCode);
    };
    return this.client.subscribe(topic, opts);
};

PahoAdapter.prototype.unsubscribe = function (topic, opts, cb) {
    opts = opts || {};
    cb = cb || function () {};
    opts.onSuccess = function (messsage) {
        cb();
    };
    return this.client.unsubscribe(topic, opts);
};

PahoAdapter.prototype.publish = function (topic, message) {
    var m = new Paho.MQTT.Message(message);
    m.destinationName = topic;
    return this.client.send(m);
};

PahoAdapter.prototype.close = function () {
    try {
        this.client.disconnect();
    } catch (e) {
        console.warn(e.message);
        this.emit('close');
    }
};
