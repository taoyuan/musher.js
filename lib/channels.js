"use strict";

var Channel = require('./channel');
var Router = require('./router');
var utils = require('./utils');

module.exports = Channels;

function Channels(socket) {
    this.socket = socket;
    this.key = socket.key;
    this.adapter = socket.adapter;

    this.router = Router();
    this._channels = {};
}

Channels.prototype.add = function (name, socket) {
    var channel = this._channels[name];
    if (channel) return channel;
    channel = this._channels[name] = createChannel(name, socket);
    this.router.addRoute(name, name);
    return channel;
};

Channels.prototype.remove = function (name) {
    var channel = this.find(name);
    if (channel) {
        delete this._channels[name];
        this.router.removeRoute(name);
    }

    return channel;
};

Channels.prototype.find = function (name) {
    return this._channels[name];
};

Channels.prototype.unsubscribeAll = function (cb) {
    if (!this._channels) return cb();
    var invokers = [];
    utils.each(this._channels, function (channel) {
        invokers.push(channel.unsubscribe.bind(channel));
    });
    return utils.parallel(invokers, cb);
};

Channels.prototype._handleMessage = function (topic, message) {
    topic = this.socket._unwrap(topic);
    var matched = this.router.match(topic);
    if (!matched) throw new Error('No channel to handle message with topic [' + topic + ']');
    var channel;
    while (matched) {
        channel = this._channels[matched.data];
        channel._handleMessage(message, {
            topic: topic,
            params: matched.params,
            splats: matched.splats,
            path: matched.route
        });
        matched = matched.next();
    }
};

function createChannel(name, socket) {
    return new Channel(name, socket);
}

