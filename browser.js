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
