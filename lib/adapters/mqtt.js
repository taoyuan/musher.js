"use strict";

var mqtt = require('mqtt');
var Emitter = require('../emitter');

var defaultPort = 1883;
var defaultSecurePort = 2883;

exports.initialize = function initialize(socket, utils) {
    var settings = socket.settings || {};

    var options = settings.options = settings.options || {};
    options.clientId = settings.clientId || utils.makeId();
    if (settings.key) options.username = settings.key;
    if (settings.secret) options.password = settings.secret;

    if (settings.useSSL) {
        options.protocol = 'mqtts';
        options.port = Number(settings.port || defaultSecurePort);
    } else {
        options.protocol = 'mqtt';
        options.port = Number(settings.port || defaultPort);
    }
    options.host = settings.host || 'localhost';

    var client = mqtt.connect(options);

    socket.client = client;
    socket.adapter = new Mqtt(client);
};

function Mqtt(client) {
    var adapter = this;
    this.client = client;

    client.on('error', function (err) {
        adapter.emit('error', err);
    });

    client.on('connect', function () {
        adapter.emit('connect');
    });

    client.on('close', function () {
        adapter.emit('close');
    });

    client.on('message', function (topic, message, packet) {
        adapter.emit('message', topic, message, packet)
    });
}

Emitter.extend(Mqtt);

Mqtt.prototype.__defineGetter__('connected', function () {
    return this.client.connected;
});

Mqtt.prototype.subscribe = function (topic, options, callback) {
    return this.client.subscribe(topic, options, callback);
};

Mqtt.prototype.unsubscribe = function (topic, options, cb) {
    return this.client.unsubscribe(topic, cb);
};

Mqtt.prototype.publish = function (topic, message) {
    this.client.publish(topic, message);
};

Mqtt.prototype.close = function () {
    return this.client.end();
};
