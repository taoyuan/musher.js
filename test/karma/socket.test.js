var t = assert;

describe('Musher', function () {

    var socket;

    beforeEach(function () {
        socket = new musher.connect({
            host:'127.0.0.1',
            port: 3883
        });
    });

    afterEach(function (done) {
        socket.close(done);
    });

    it('should initiate socket', function (done) {
        t.ok(socket);
        if (socket.connected) return done();
        socket.once('connected', done);
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
});