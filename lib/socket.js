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
    var settings = this.settings = utils.assign({host: defaultHost}, opts);
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
        process.nextTick(function () {
            that._message(topic, message);
        });
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

/**
 *
 * @param topic
 * @param opts
 * @param handler function(data, route), `data` is the message body, `route` is an object includes:
 *  {topic: String, event: String = 'message', params: Object, slats: Array, path: String}
 */
Socket.prototype.subscribe = function (topic, opts, handler) {
    if (typeof opts === "function") {
        handler = opts;
        opts = null;
    }
    var channel = this.channels.add(topic, this);
    channel.handler = handler;
    this.ready(function () {
        channel.subscribe(opts, function (err) {
            if (err) throw err;
        });
    });
    return channel;
};

Socket.prototype.unsubscribe = function (name, cb) {
    cb = cb || utils.nop;
    var channel = this.channels.remove(name, cb);
    channel.handler = null;
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
    if (!topic) throw new Error('`topic` is required');
    if (typeof event !== 'string' && arguments.length > 2) {
        data = event;
        event = null;
    }

    topic = this._wrap(topic);
    var message = JSON.stringify(event ? {__event__: event, __data__: data} : data);
    this.adapter.publish(topic, message);
};