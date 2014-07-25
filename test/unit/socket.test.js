var s = require('../support');
var t = s.t;


describe('socket', function () {

    var server;

    before(function (done) {
        s.start(function (err, _server) {
            server = _server;
            done();
        });
    });

    after(function () {
        server.close();
    });

    describe('basic', function () {

        var socket;

        beforeEach(function () {
            socket = s.connect('test_key');
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
            var socketPub = s.connect('test_key');
            var data = {boo: 'foo'};
            var channel = socket.subscribe('tom');
            channel.on('data', function (message) {
                t.deepEqual(data, message);
                done();
            });
            socketPub.publish('tom', 'data', data);
        });
    });

    describe('subscribe on connected', function () {

        it('should subscribe immediately', function (done) {
            var socket = s.connect('test_key');
            socket.on('connected', function () {
                var data = {boo: 'foo'};
                var channel = socket.subscribe('tom');
                channel.on('data', function (message) {
                    t.deepEqual(data, message);
                    done();
                });
                socket.publish('tom', 'data', data);
            });
        })
    });
});