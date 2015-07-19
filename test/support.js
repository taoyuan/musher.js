var chai = require('chai');
var t = chai.assert;
var musherd = require('musherd');
var musher = require('../');

exports.t = t;

exports.connect = function (key, options) {
    if (typeof key === 'object') {
        options = key;
        key = undefined;
    }
    return musher.connect(key, musher.utils.assign({
        host: '127.0.0.1'
    }, options));
};

var OPTIONS = ['http-port'];
function isValidOptions(option) {
    for (var i = 0; i < OPTIONS.length; i++) {
        if (option == OPTIONS[i]) return true;
    }
    return false;
}

exports.start = function (options, cb) {
    if (typeof options === 'function') {
        cb = options;
        options = {};
    }
    options = options || {};
    cb = cb || function () {};

    var args = ['node', 'musherd'];
    for (var key in options) if (options.hasOwnProperty(key) && isValidOptions(key)) {
        args.push('--' + key);
        args.push(options[key]);
    }
    musherd.cli(args, cb);

};
