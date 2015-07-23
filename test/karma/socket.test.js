var t = assert;

describe('Musher', function () {

    var socket;

    beforeEach(function (done) {
        socket = musher.connect('test_key', {
            host:'127.0.0.1'
        });
        socket.ready(done);
    });

    afterEach(function (done) {
        socket.close(done);
    });

    it('should initiate socket', function (done) {
        t.ok(socket);
        socket.ready(done);
    });

    it('should subscribe', function (done) {
        var data = {boo: 'foo'};
        var channel = socket.subscribe('tom');
        channel.on('data', function handle_data (message) {
            t.deepEqual(data, message);
            done();
        });
        socket.publish('tom', 'data', data);
        setTimeout(function () {
            console.log(socket.channels.find(channel.name)._callbacks);
        }, 1000);

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

    it('should call the handler when subscribe with handler', function (done) {
        socket.subscribe('/hello', function (data, route) {
            t.equal(route.topic, '/hello');
            t.deepEqual(data, {hello: 'world'});
            done();
        });

        socket.publish('/hello', {hello: 'world'});
    });
});