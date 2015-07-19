"use strict";

var mqtt = require('mqtt');
var merge = require('utils-merge');
var Emitter = require('../emitter');

var defaultHost = 'localhost';
var defaultPort = 1883;
var defaultSecurePort = 2883;

exports.initialize = function initialize(socket, utils) {
    var settings = socket.settings || {};

    var options = {};
    options.clientId = settings.clientId || utils.makeId();
    options.username = settings.username || settings.key;
    options.password = settings.password || settings.secret;
    options.protocol = settings.protocol || (settings.useSSL ? 'mqtts' : 'mqtt');
    options.port = Number(settings.port || (settings.useSSL ? defaultSecurePort : defaultPort));
    options.host = settings.host || defaultHost;
    merge(options, settings.options);

    merge(settings, options); // update settings

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

    client.on('reconnect', function () {
        adapter.emit('reconnect');
    });

    client.on('offline', function () {
        adapter.emit('offline');
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
