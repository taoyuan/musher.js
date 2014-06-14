(function (define) {
    "use strict";

    define(function () {

        var breaker = {};

        var ArrayProto = Array.prototype;

        var nativeForEach = ArrayProto.forEach;
        var slice = ArrayProto.slice;

        return {
            nop: nop,
            each: forEach,
            forEach: forEach,
            assign: assign,
            parallel: parallel,
            sure: sure,
            makeId: makeId,
            parseAuthOptions: parseAuthOptions
        };

        function nop() {
        }

        function forEach(obj, iterator, context) {
            if (obj == null) return;
            if (nativeForEach && obj.forEach === nativeForEach) {
                obj.forEach(iterator, context);
            } else if (obj.length === +obj.length) {
                for (var i = 0, length = obj.length; i < length; i++) {
                    if (iterator.call(context, obj[i], i, obj) === breaker) return;
                }
            } else {
                var keys = obj.keys;
                for (var i = 0, length = keys.length; i < length; i++) {
                    if (iterator.call(context, obj[keys[i]], keys[i], obj) === breaker) return;
                }
            }
        }


        function assign(obj) {
            forEach(slice.call(arguments, 1), function (source) {
                if (source) {
                    for (var prop in source) {
                        obj[prop] = source[prop];
                    }
                }
            });
            return obj;
        }

        function parallel(tasks, callback) {
            var results = [], count = tasks.length;
            tasks.forEach(function (task, index) {
                task(function (err, data) {
                    results[index] = data;
                    if (err) {
                        callback(err);
                        callback = null;
                    }
                    if (--count === 0 && callback) {
                        callback(null, results);
                    }
                });
            });
        }

        function sure(obj, key, value) {
            var v = obj[key];
            return v ? v : obj[key] = (typeof value === 'function' ? value.call(obj) : value);
        }

        function makeId(prefix) {
            var i, possible, text;
            text = "";
            possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
            for (i = 0; i < 5; i++) {
                text += possible.charAt(Math.floor(Math.random() * possible.length));
            }
            return (prefix ? prefix :'musher-') + text;
        }

        function parseAuthOptions(auth, opts) {
            if(auth){
                if (auth.key) {
                    opts.username = auth.key;
                }
                if (auth.secret) {
                    opts.password = auth.secret;
                }
            }
        }

    });

})(typeof define === 'function' && define.amd ? define : function (factory) {
    module.exports = factory(require);
});