var s = require('../support');
var t = s.t;


describe('musher', function () {

    var server;

    before(function (done) {
        server = s.start(function () {done();});
    });

    after(function () {
        server.close();
    });

    describe('basic', function () {

        var socket;

        beforeEach(function () {
            socket = s.connect();
        });

        afterEach(function (done) {
            socket.close(done);
        });


        it('should initiate socket', function () {
            t.ok(socket);
            t.ok(socket.adapter);
        });

        it('should subscribe', function (done) {
            var data = {boo: 'foo'};
            var channel = socket.subscribe('tom');
            channel.on('data', function (message) {
                t.deepEqual(data, message);
                done();
            });
            socket.publish('tom', 'data', data);
        });

        it('should not received data when unsubscribe', function (done) {
            var data = {boo: 'foo'};
            var channel = socket.subscribe('tom');
            channel.on('data', function (message) {
                t.deepEqual(data, message);

                channel.unsubscribe(function () {
                    socket.publish('tom', 'data', data);
                    setTimeout(done, 200);
                });
            });
            socket.publish('tom', 'data', data);
        });

        it('should sub and pub with different socket', function (done) {
            var socketPub = s.connect();
            var data = {boo: 'foo'};
            var channel = socket.subscribe('tom');
            channel.on('data', function (message) {
                t.deepEqual(data, message);
                done();
            });
            socketPub.publish('tom', 'data', data);
        });
    });

    describe('with key', function () {
        var socket;

        beforeEach(function () {
            socket = s.connect('hello');
        });

        afterEach(function (done) {
            socket.close(done);
        });

        it('should sub and pub with key', function (done) {
            var socketPub = s.connect('hello');
            var data = {boo: 'foo'};
            var channel = socket.subscribe('/chat/secret');
            channel.on('data', function (message) {
                t.deepEqual(data, message);
                done();
            });
            socketPub.publish('/chat/secret', 'data', data);
        });

    });


});