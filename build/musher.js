/***********************************************
* Musher Javascript and Node.js Library v0.1.5
* https://github.com/taoyuan/musher
* 
* Copyright (c) 2015 Tao Yuan.
* Licensed MIT 
* 
* Date: 2015-07-19 12:21
***********************************************/
(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.musher = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var Socket = require('./lib/socket');

exports.connect = function (key, settings) {
    if (typeof key === 'object') {
        settings = key;
        key = null;
    }
    settings = settings || {};
    if (key) settings.key = key;
    return new Socket(require('./lib/adapters/paho'), settings);
};

exports.Socket = Socket;
exports.utils = require('./lib/utils');

},{"./lib/adapters/paho":2,"./lib/socket":7,"./lib/utils":8}],2:[function(require,module,exports){
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

},{"../emitter":5}],3:[function(require,module,exports){
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

Channel.prototype._handleMessage = function (message, route) {
    message = JSON.parse(message);
    var event = message.__event__ || route.params.event || 'message';
    var data = message.__data__ || message;
    this.emit(event, data, route);
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
},{"./emitter":5}],4:[function(require,module,exports){
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
    this.router.addRoute(name, channel);
    return channel;
};

Channels.prototype.remove = function (name) {
    var channel = this.find(name);
    if (channel) {
        delete this._channels[name];
        this.router.removeRoute(channel);
    }

    return channel;
};

Channels.prototype.find = function (name) {
    return this._channels[name];
};

Channels.prototype.unsubscribeAll = function (cb) {
    if (!this.channels) return cb();
    var invokers = [];
    utils.each(this.channels, function (channel) {
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
        channel = matched.data;
        channel._handleMessage(message, {
            params: matched.params,
            splats: matched.splats,
            path: matched.route,
            topic: topic
        });
        matched = matched.next();
    }
};

function createChannel(name, socket) {
    return new Channel(name, socket);
}


},{"./channel":3,"./router":6,"./utils":8}],5:[function(require,module,exports){
"use strict";

var utils = require('./utils');

module.exports = Emitter;

function Emitter() {
}

/**
 * Mixin the emitter properties.
 *
 * @param {Object} obj
 * @return {Object}
 * @api private
 */

Emitter.mixin = function (obj) {
    utils.assign(obj, Emitter.prototype);
    return obj;
};

Emitter.extend = function (obj) {
    utils.assign(obj.prototype, Emitter.prototype);
    return obj;
};

/**
 * Listen on the given `event` with `fn`.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.on =
    Emitter.prototype.addEventListener = function (event, fn) {
        this._callbacks = this._callbacks || {};
        (this._callbacks[event] = this._callbacks[event] || [])
            .push(fn);
        return this;
    };

/**
 * Adds an `event` listener that will be invoked a single
 * time then automatically removed.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.once = function (event, fn) {
    var self = this;
    this._callbacks = this._callbacks || {};

    function on() {
        self.off(event, on);
        fn.apply(this, arguments);
    }

    on.fn = fn;
    this.on(event, on);
    return this;
};

/**
 * Remove the given callback for `event` or all
 * registered callbacks.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.off =
    Emitter.prototype.removeListener =
        Emitter.prototype.removeAllListeners =
            Emitter.prototype.removeEventListener = function (event, fn) {
                this._callbacks = this._callbacks || {};

                // all
                if (0 == arguments.length) {
                    this._callbacks = {};
                    return this;
                }

                // specific event
                var callbacks = this._callbacks[event];
                if (!callbacks) return this;

                // remove all handlers
                if (1 == arguments.length) {
                    delete this._callbacks[event];
                    return this;
                }

                // remove specific handler
                var cb;
                for (var i = 0; i < callbacks.length; i++) {
                    cb = callbacks[i];
                    if (cb === fn || cb.fn === fn) {
                        callbacks.splice(i, 1);
                        break;
                    }
                }
                return this;
            };

/**
 * Emit `event` with the given args.
 *
 * @param {String} event
 * @param {Mixed} ...
 * @return {Emitter}
 */

Emitter.prototype.emit = function (event) {
    this._callbacks = this._callbacks || {};
    var args = [].slice.call(arguments, 1)
        , callbacks = this._callbacks[event];

    if (callbacks) {
        callbacks = callbacks.slice(0);
        for (var i = 0, len = callbacks.length; i < len; ++i) {
            callbacks[i].apply(this, args);
        }
    }

    return this;
};

/**
 * Return array of callbacks for `event`.
 *
 * @param {String} event
 * @return {Array}
 * @api public
 */

Emitter.prototype.listeners = function (event) {
    this._callbacks = this._callbacks || {};
    return this._callbacks[event] || [];
};

/**
 * Check if this emitter has `event` handlers.
 *
 * @param {String} event
 * @return {Boolean}
 * @api public
 */

Emitter.prototype.hasListeners = function (event) {
    return !!this.listeners(event).length;
};

},{"./utils":8}],6:[function(require,module,exports){
/**
 * Convert path to route object
 *
 * A string or RegExp should be passed,
 * will return { re, src, keys} obj
 *
 * @param  {String / RegExp} path
 * @return {Object}
 */

var Route = function (path) {
    //using 'new' is optional

    var src, re, keys = [];

    if (path instanceof RegExp) {
        re = path;
        src = path.toString();
    } else {
        re = pathToRegExp(path, keys);
        src = path;
    }

    return {
        re: re,
        src: src,
        keys: keys
    }
};

/**
 * Normalize the given path string,
 * returning a regular expression.
 *
 * An empty array should be passed,
 * which will contain the placeholder
 * key names. For example "/user/:id" will
 * then contain ["id"].
 *
 * @param  {String} path
 * @param  {Array} keys
 * @return {RegExp}
 */
var pathToRegExp = function (path, keys) {
    path = path
        .concat('/?')
        .replace(/\/\(/g, '(?:/')
        .replace(/(\/)?(\.)?:(\w+)(?:(\(.*?\)))?(\?)?|\*/g, function (_, slash, format, key, capture, optional) {
            if (_ === "*") {
                keys.push(undefined);
                return _;
            }

            keys.push(key);
            slash = slash || '';
            return ''
                + (optional ? '' : slash)
                + '(?:'
                + (optional ? slash : '')
                + (format || '') + (capture || '([^/]+?)') + ')'
                + (optional || '');
        })
        .replace(/([\/.])/g, '\\$1')
        .replace(/\*/g, '(.*)');
    return new RegExp('^' + path + '$', 'i');
};

/**
 * Attempt to match the given request to
 * one of the routes. When successful
 * a  {fn, params, splats} obj is returned
 *
 * @param  {Array} routes
 * @param  {String} uri
 * @param  {Number} startAt
 * @return {Object}

 */
var match = function (routes, uri, startAt) {
    var captures, i = startAt || 0, len, j;

    for (len = routes.length; i < len; ++i) {
        var route = routes[i],
            re = route.re,
            keys = route.keys,
            splats = [],
            params = {};

        if (captures = uri.match(re)) {
            for (j = 1, len = captures.length; j < len; ++j) {
                var key = keys[j - 1],
                    val = typeof captures[j] === 'string'
                        ? decodeURI(captures[j])
                        : captures[j];
                if (key) {
                    params[key] = val;
                } else {
                    splats.push(val);
                }
            }
            return {
                params: params,
                splats: splats,
                route: route.src,
                next: i + 1
            };
        }
    }
};

/**
 * Default "normal" router constructor.
 * accepts path, data tuples via addRoute
 * returns {fn, params, splats, path}
 *  via match
 *
 * @return {Object}
 */

function Router() {
    this.routes = [];
}

Router.prototype.addRoute = function (path, data) {
    if (!path) throw new Error(' route requires a path');
    path = path.replace(/\$/, "\\$");
    var route = Route(path);
    route.data = data;

    this.routes.push(route);
};

Router.prototype.removeRoute = function (data) {
    if (!data) throw new Error('data must not be null');

    var i, len = this.routes.length;
    for (i = 0; i < len; i++) {
        if (this.routes[i].data === data) break;
    }
    if (i < len) this.routes.splice(i, 1);
};

Router.prototype.match = function (path, startAt) {
    var matched = match(this.routes, path, startAt);
    if (matched) {
        var route = this.routes[matched.next - 1];
        matched.data = route.data;
        matched.next = this.match.bind(this, path, matched.next)
    }
    return matched;
};

exports = module.exports = function () {
    return new Router();
};

exports.Route = Route;
exports.pathToRegExp = pathToRegExp;
exports.match = match;


},{}],7:[function(require,module,exports){
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

    var socket = this;
    this.adapter.on('error', function () {
        socket.emit('error')
    });
    this.adapter.on('connect', function () {
        socket._connected();
    });
    this.adapter.on('close', function () {
        socket._close();
    });
    this.adapter.on('message', function (topic, message, packet) {
        socket._message(topic, message);
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
},{"./channels":4,"./emitter":5,"./utils":8,"debug":9}],8:[function(require,module,exports){
"use strict";

var breaker = {};

var ArrayProto = Array.prototype;

var nativeForEach = ArrayProto.forEach;
var slice = ArrayProto.slice;

exports = module.exports = {
    nop: nop,
    each: forEach,
    forEach: forEach,
    assign: assign,
    parallel: parallel,
    sure: sure,
    makeId: makeId,
    parseAuthOptions: parseAuthOptions
};

function nop() {
}

function forEach(obj, iterator, context) {
    if (obj == null) return;
    if (nativeForEach && obj.forEach === nativeForEach) {
        obj.forEach(iterator, context);
    } else if (obj.length === +obj.length) {
        for (var i = 0, length = obj.length; i < length; i++) {
            if (iterator.call(context, obj[i], i, obj) === breaker) return;
        }
    } else {
        var keys = obj.keys;
        for (var i = 0, length = keys.length; i < length; i++) {
            if (iterator.call(context, obj[keys[i]], keys[i], obj) === breaker) return;
        }
    }
}


function assign(obj) {
    forEach(slice.call(arguments, 1), function (source) {
        if (source) {
            for (var prop in source) {
                obj[prop] = source[prop];
            }
        }
    });
    return obj;
}

function parallel(tasks, callback) {
    var results = [], count = tasks.length;
    tasks.forEach(function (task, index) {
        task(function (err, data) {
            results[index] = data;
            if (err) {
                callback(err);
                callback = null;
            }
            if (--count === 0 && callback) {
                callback(null, results);
            }
        });
    });
}

function sure(obj, key, value) {
    var v = obj[key];
    return v ? v : obj[key] = (typeof value === 'function' ? value.call(obj) : value);
}

function makeId(prefix) {
    var i, possible, text;
    text = "";
    possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (i = 0; i < 5; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return (prefix ? prefix : 'musher-') + text;
}

function parseAuthOptions(auth, opts) {
    if (auth) {
        if (auth.key) {
            opts.username = auth.key;
        }
        if (auth.secret) {
            opts.password = auth.secret;
        }
    }
}
},{}],9:[function(require,module,exports){

/**
 * This is the web browser implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = require('./debug');
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.storage = 'undefined' != typeof chrome
               && 'undefined' != typeof chrome.storage
                  ? chrome.storage.local
                  : localstorage();

/**
 * Colors.
 */

exports.colors = [
  'lightseagreen',
  'forestgreen',
  'goldenrod',
  'dodgerblue',
  'darkorchid',
  'crimson'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

function useColors() {
  // is webkit? http://stackoverflow.com/a/16459606/376773
  return ('WebkitAppearance' in document.documentElement.style) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (window.console && (console.firebug || (console.exception && console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31);
}

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

exports.formatters.j = function(v) {
  return JSON.stringify(v);
};


/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs() {
  var args = arguments;
  var useColors = this.useColors;

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? ' %c' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ')
    + '+' + exports.humanize(this.diff);

  if (!useColors) return args;

  var c = 'color: ' + this.color;
  args = [args[0], c, 'color: inherit'].concat(Array.prototype.slice.call(args, 1));

  // the final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  var index = 0;
  var lastC = 0;
  args[0].replace(/%[a-z%]/g, function(match) {
    if ('%%' === match) return;
    index++;
    if ('%c' === match) {
      // we only are interested in the *last* %c
      // (the user may have provided their own)
      lastC = index;
    }
  });

  args.splice(lastC, 0, c);
  return args;
}

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */

function log() {
  // this hackery is required for IE8/9, where
  // the `console.log` function doesn't have 'apply'
  return 'object' === typeof console
    && console.log
    && Function.prototype.apply.call(console.log, console, arguments);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  try {
    if (null == namespaces) {
      exports.storage.removeItem('debug');
    } else {
      exports.storage.debug = namespaces;
    }
  } catch(e) {}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  var r;
  try {
    r = exports.storage.debug;
  } catch(e) {}
  return r;
}

/**
 * Enable namespaces listed in `localStorage.debug` initially.
 */

exports.enable(load());

/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */

function localstorage(){
  try {
    return window.localStorage;
  } catch (e) {}
}

},{"./debug":10}],10:[function(require,module,exports){

/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = debug;
exports.coerce = coerce;
exports.disable = disable;
exports.enable = enable;
exports.enabled = enabled;
exports.humanize = require('ms');

/**
 * The currently active debug mode names, and names to skip.
 */

exports.names = [];
exports.skips = [];

/**
 * Map of special "%n" handling functions, for the debug "format" argument.
 *
 * Valid key names are a single, lowercased letter, i.e. "n".
 */

exports.formatters = {};

/**
 * Previously assigned color.
 */

var prevColor = 0;

/**
 * Previous log timestamp.
 */

var prevTime;

/**
 * Select a color.
 *
 * @return {Number}
 * @api private
 */

function selectColor() {
  return exports.colors[prevColor++ % exports.colors.length];
}

/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */

function debug(namespace) {

  // define the `disabled` version
  function disabled() {
  }
  disabled.enabled = false;

  // define the `enabled` version
  function enabled() {

    var self = enabled;

    // set `diff` timestamp
    var curr = +new Date();
    var ms = curr - (prevTime || curr);
    self.diff = ms;
    self.prev = prevTime;
    self.curr = curr;
    prevTime = curr;

    // add the `color` if not set
    if (null == self.useColors) self.useColors = exports.useColors();
    if (null == self.color && self.useColors) self.color = selectColor();

    var args = Array.prototype.slice.call(arguments);

    args[0] = exports.coerce(args[0]);

    if ('string' !== typeof args[0]) {
      // anything else let's inspect with %o
      args = ['%o'].concat(args);
    }

    // apply any `formatters` transformations
    var index = 0;
    args[0] = args[0].replace(/%([a-z%])/g, function(match, format) {
      // if we encounter an escaped % then don't increase the array index
      if (match === '%%') return match;
      index++;
      var formatter = exports.formatters[format];
      if ('function' === typeof formatter) {
        var val = args[index];
        match = formatter.call(self, val);

        // now we need to remove `args[index]` since it's inlined in the `format`
        args.splice(index, 1);
        index--;
      }
      return match;
    });

    if ('function' === typeof exports.formatArgs) {
      args = exports.formatArgs.apply(self, args);
    }
    var logFn = enabled.log || exports.log || console.log.bind(console);
    logFn.apply(self, args);
  }
  enabled.enabled = true;

  var fn = exports.enabled(namespace) ? enabled : disabled;

  fn.namespace = namespace;

  return fn;
}

/**
 * Enables a debug mode by namespaces. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} namespaces
 * @api public
 */

function enable(namespaces) {
  exports.save(namespaces);

  var split = (namespaces || '').split(/[\s,]+/);
  var len = split.length;

  for (var i = 0; i < len; i++) {
    if (!split[i]) continue; // ignore empty strings
    namespaces = split[i].replace(/\*/g, '.*?');
    if (namespaces[0] === '-') {
      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      exports.names.push(new RegExp('^' + namespaces + '$'));
    }
  }
}

/**
 * Disable debug output.
 *
 * @api public
 */

function disable() {
  exports.enable('');
}

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

function enabled(name) {
  var i, len;
  for (i = 0, len = exports.skips.length; i < len; i++) {
    if (exports.skips[i].test(name)) {
      return false;
    }
  }
  for (i = 0, len = exports.names.length; i < len; i++) {
    if (exports.names[i].test(name)) {
      return true;
    }
  }
  return false;
}

/**
 * Coerce `val`.
 *
 * @param {Mixed} val
 * @return {Mixed}
 * @api private
 */

function coerce(val) {
  if (val instanceof Error) return val.stack || val.message;
  return val;
}

},{"ms":11}],11:[function(require,module,exports){
/**
 * Helpers.
 */

var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} options
 * @return {String|Number}
 * @api public
 */

module.exports = function(val, options){
  options = options || {};
  if ('string' == typeof val) return parse(val);
  return options.long
    ? long(val)
    : short(val);
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse(str) {
  str = '' + str;
  if (str.length > 10000) return;
  var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(str);
  if (!match) return;
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'yrs':
    case 'yr':
    case 'y':
      return n * y;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'hrs':
    case 'hr':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'mins':
    case 'min':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 'secs':
    case 'sec':
    case 's':
      return n * s;
    case 'milliseconds':
    case 'millisecond':
    case 'msecs':
    case 'msec':
    case 'ms':
      return n;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function short(ms) {
  if (ms >= d) return Math.round(ms / d) + 'd';
  if (ms >= h) return Math.round(ms / h) + 'h';
  if (ms >= m) return Math.round(ms / m) + 'm';
  if (ms >= s) return Math.round(ms / s) + 's';
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function long(ms) {
  return plural(ms, d, 'day')
    || plural(ms, h, 'hour')
    || plural(ms, m, 'minute')
    || plural(ms, s, 'second')
    || ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, n, name) {
  if (ms < n) return;
  if (ms < n * 1.5) return Math.floor(ms / n) + ' ' + name;
  return Math.ceil(ms / n) + ' ' + name + 's';
}

},{}]},{},[1])(1)
});