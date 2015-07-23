"use strict";

var musher = require('../');

var socket = musher.connect({host: 'localhost'});

socket.on('connected', function () {
    console.log('connected');
});
socket.on('reconnect', function () {
    console.log('reconnect');
});
socket.on('offline', function () {
    console.log('offline');
});
socket.on('error', function (err) {
    console.error(err);
});

var channel = socket.subscribe('/users/:userid/message/:messageid/*');
channel.on('data', function (data, route) {
    console.log(data);              // { hello: 'world' }
    console.log(route.topic);     // '/users/ty/message/4321/ping'
    console.log(route.params);    // { userid: 'ty', messageid: 4321 }
    console.log(route.splats);    // [ 'ping' ]
    console.log(route.path);      // '/users/:userid/message/:messageid/:method'
    console.log(route.event);     // 'data'
});

socket.publish('/users/ty/message/4321/ping', 'data', {hello: 'world'});