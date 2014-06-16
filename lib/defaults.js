(function (define) {
    "use strict";

    define(function () {
        return function () {
            return {
                host: 'musher.ollo.io'
            }
        }
    });

})(typeof define === 'function' && define.amd ? define : function (factory) {
    module.exports = factory(require);
});