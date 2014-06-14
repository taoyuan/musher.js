var Socket = require('./lib/socket');

Socket.defaults({
    host: 'sock.musher.im',
    port: 1883
});

exports.utils = require('./lib/utils');

exports.connect = function (key, settings) {
    if (typeof key === 'object') {
        settings = key;
        key = null;
    }
    settings = settings || {};
    if (key) settings.key = key;
    return new Socket(require('./lib/adapters/mqtt'), settings);
};

exports.Socket = Socket;