(function (define) {
    "use strict";

    define(function () {
        return function () {
            return {
                host: 'musher.io'
            }
        }
    });

})(typeof define === 'function' && define.amd ? define : function (factory) {
    module.exports = factory(require);
});