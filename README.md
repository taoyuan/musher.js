muhser.js
======
[![NPM Version](https://img.shields.io/npm/v/musher.svg?style=flat)](https://www.npmjs.org/package/musher)
[![Build Status](http://img.shields.io/travis/taoyuan/musher.js.svg?style=flat)](https://travis-ci.org/taoyuan/musher.js)
[![Dependencies](https://img.shields.io/david/taoyuan/musher.js.svg?style=flat)](https://david-dm.org/taoyuan/musher.js)

Musher is a javascript and node.js library based on mqtt.

## Build
```bash
npm install
grunt
```

## Usage

### Subscribe with a handler.

```js
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

socket.subscribe('/users/:userid/message/:messageid/*', function (data, route) {
    console.log(data);            // { hello: 'world' }
    console.log(route.topic);     // '/users/ty/message/4321/ping'
    console.log(route.params);    // { userid: 'ty', messageid: 4321 }
    console.log(route.splats);    // [ 'ping' ]
    console.log(route.path);      // '/users/:userid/message/:messageid/:method'
    console.log(route.event);     // 'message'
});

socket.publish('/users/ty/message/4321/ping', {hello: 'world'});
```

### Subscribe with event.

```js
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
    console.log(data);            // { hello: 'world' }
    console.log(route.topic);     // '/users/ty/message/4321/ping'
    console.log(route.params);    // { userid: 'ty', messageid: 4321 }
    console.log(route.splats);    // [ 'ping' ]
    console.log(route.path);      // '/users/:userid/message/:messageid/:method'
    console.log(route.event);     // 'data'
});

socket.publish('/users/ty/message/4321/ping', 'data', {hello: 'world'});

```

The built libraries will be in `build` directory

