"use strict";

var Emitter = require('./emitter');

module.exports = Channel;

function Channel(name, socket) {
    if (!(this instanceof Channel)) {
        return new Channel(name, socket);
    }
    this.socket = socket;
    this.adapter = socket.adapter;
    this.name = name;
    this.topic = socket._wrap(format(name));
}

Emitter.extend(Channel);

Channel.prototype.bind = Channel.prototype.on;

Channel.prototype.subscribe = function (opts, cb) {
    if (typeof opts === 'function') {
        cb = opts;
        opts = null;
    }
    var self = this;
    this.adapter.subscribe(this.topic, opts, function (err) {
        if (cb) cb.call(self, err, self);
    });
    return this;
};

/**
 * unsubscribe - unsubscribe from channel
 *
 * @param {Function} [cb] - callback fired on unsuback
 * @returns {Channel} this - for chaining
 * @example channel.unsubscribe('topic');
 * @example channel.unsubscribe('topic', console.log);
 */
Channel.prototype.unsubscribe = function (cb) {
    this.adapter.unsubscribe(this.topic, {}, cb);
    return this;
};

Channel.prototype._handleMessage = function (message) {
    message = JSON.parse(message);
    if (message.__event__ && message.__data__) {
        this.emit(message.__event__, message.__data__);
    }
};

/**
 * Convenience method for publish through channel.
 *
 * @param event
 * @param data
 */
Channel.prototype.publish = function (event, data) {
    this.socket.publish(this.topic, event, data);
};

function format(path) {
    return path.replace(/\:[a-zA-Z0-9]+/g, "+")
        .replace(/\*\*/g, "#")
        .replace(/\*/g, "+");
}