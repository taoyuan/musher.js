var chai = require('chai');
var t = chai.assert;
var mosca = require('mosca');
var musher = require('../');

exports.t = t;

exports.connect = function (key, options) {
    if (typeof key === 'object') {
        options = key;
        key = undefined;
    }
    return musher.connect(key, musher.utils.assign({
        host: 'localhost',
        port: 1883
    }, options));
};

exports.start = function (options, cb) {
    if (typeof options === 'function') {
        cb = options;
        options = {};
    }
    options = options || {};
    cb = cb || function () {};

    var server = new mosca.Server(options);   //here we start mosca
    server.on('ready', setup);  //on init it fires up setup()

    // fired when the mqtt server is ready
    function setup() {
        if (cb.length > 0) return cb(server);
        return cb();
    }

    return server;
};