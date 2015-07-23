var Socket = require('./lib/socket');

/**
 *
 * @param key
 * @param settings
 * @returns {Socket|exports|module.exports}
 */
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
exports.utils = require('./lib/utils');