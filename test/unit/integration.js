"use strict";

var mush = require('mush');
var s = require('../support');
var t = s.t;

describe('integration', function () {

    var server = null,
        args = null;

    beforeEach(function () {
        args = ["node", "mush"];
    });

    afterEach(function (done) {
        server && server.close(function () {
            done();
        });
        server = null;
    });

    var startServer = function (callback) {
        return mush.cli(args, function (err, s) {
            server = s;
            callback(err, server);
        });
    };

    it('should support key and secret for secure subscribe and publish', function (done) {
        args.push("--auth");
        args.push("test/auth.json");

        startServer(function (err, server) {
            t.notOk(err);
            var socketSub = s.connect('test_key');
            var data = {boo: 'foo'};
            var channel = socketSub.subscribe('chat/secret');
            channel.on('data', function (message) {
                t.deepEqual(data, message);
                done();
            });

            var socketPub = s.connect({
                key: 'test_key',
                secret: 'kyte7mewy230faey2use'
            });
            socketPub.publish('chat/secret', 'data', data);
        });
    });

});