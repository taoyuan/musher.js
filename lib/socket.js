"use strict";
var debug = require('debug')('musher:socket');
var utils = require('./utils');
var Emitter = require('./emitter');
var Channels = require('./channels');

var defaultHost = 'musher.io';

module.exports = Socket;

function Socket(adapter, opts) {
    if (!(this instanceof Socket)) {
        return new Socket(adapter, opts);
    }

    // just save everything we get
    var settings = this.settings = utils.assign({ host: defaultHost }, opts);
    this.key = settings.key;
    this.prefix = this.key ? '$' + this.key + ':' : null;

    var useSSL = settings.ssl || settings.secure;
    if (useSSL !== null && useSSL !== undefined) {
        settings.useSSL = !!useSSL;
    }
    settings.options = settings.options || {};

    this.queue = [];

    // initialize adapter
    adapter.initialize(this, utils);

    // we have an adapter now?
    if (!this.adapter) {
        throw new Error('Adapter is not defined correctly: it should create `adapter` member of socket');
    }

    this.channels = new Channels(this);

    var that = this;
    this.adapter.on('error', function (err) {
        that.emit('error', err)
    });
    this.adapter.on('connect', function () {
        that._connected();
    });
    this.adapter.on('reconnect', function () {
        that.emit('reconnect')
    });
    this.adapter.on('offline', function () {
        that.emit('offline')
    });
    this.adapter.on('close', function () {
        that._close();
    });
    this.adapter.on('message', function (topic, message, packet) {
        that._message(topic, message);
    });
}

Emitter.extend(Socket);

Socket.prototype.__defineGetter__('connected', function () {
    return this.adapter.connected;
});

Socket.prototype._connected = function () {
    for (var i = 0; i < this.queue.length; i++) {
        this.queue[i]();
    }
    this.queue = [];
    this.emit('connected');
};

Socket.prototype._close = function () {
    this.emit('close');
};

Socket.prototype._enqueue = function (fn) {
    this.queue.push(fn);
};

Socket.prototype._message = function (topic, message) {
    this.channels._handleMessage(topic, message);
};

Socket.prototype._wrap = function (topic) {
    return this.prefix && topic.indexOf(this.prefix) !== 0 ? this.prefix + topic : topic;
};

Socket.prototype._unwrap = function (topic) {
    return this.prefix && topic.indexOf(this.prefix) === 0 ? topic.substring(this.prefix.length) : topic;
};

Socket.prototype.ready = function (fn) {
    if (this.connected) return fn();
    this._enqueue(fn);
};

Socket.prototype.close = function (cb) {
    if (cb) this.once('close', cb);
    this.adapter.close();
};

Socket.prototype.channel = function (name) {
    return this.channels.find(name);
};

Socket.prototype.subscribe = function (name, opts, cb) {
    if (typeof opts === "function") {
        cb = opts;
        opts = null;
    }
    var channel = this.channels.add(name, this);
    this.ready(function () {
        channel.subscribe(opts, cb);
    });
    return channel;
};

Socket.prototype.unsubscribe = function (name, cb) {
    cb = cb || utils.nop;
    var channel = this.channels.remove(name, cb);
    if (channel.connected) {
        channel.unsubscribe(cb);
    } else {
        cb();
    }
    return this;
};

Socket.prototype.publish = function (topic, event, data) {
    var socket = this;
    this.ready(function () {
        socket._publish(topic, event, data);
    });
    return this;
};

Socket.prototype._publish = function (topic, event, data) {
    if (!topic) throw new Error('`topic` must not be null');
    if (!event) throw new Error('`event` must not be null');
    if (!data) throw new Error('`data` must not be null');

    var message = JSON.stringify({__event__: event, __data__: data});
    this.adapter.publish(this._wrap(topic), message);
};