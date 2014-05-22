var util = require('util');

module.exports = {
    /**
     * @param {Object} context
     * @param {String} path
     * @param {*} value
     * @return {*} value
     */
    set : function set(context, path, value) {
        var ctx = context,
            props = path.split('.'),
            target = props.pop(),
            size = props.length,
            i = 0,
            propName,
            type;

        if (size > 0) {
            while (size > i++) {
                propName = props[i];
                type = this.typeOf(ctx[propName]);

                if (type === 'undefined') {
                    ctx[propName] = {};
                } else if (type !== 'object') {
                    // can not set value for the field of the atomic property
                    return;
                }

                ctx = ctx[propName];
            }
        }

        /* jshint boss:true */
        return ctx[target] = value;
    },

    /**
     * @param {*} value
     * @returns {String} `typeof` result extended with 'array', 'regexp', 'date' and 'error'
     */
    typeOf : function typeOf(value) {
        var type = typeof value;

        if (type === 'object') {
            if (util.isArray(value)) {
                type = 'array';
            } else if (util.isRegExp(value)) {
                type = 'regexp';
            } else if (util.isDate(value)) {
                type = 'date';
            } else if (util.isError(value)) {
                type = 'error';
            }
        }

        return type;
    },

    /**
     * @param {*} context
     * @param {String} [path]
     * @param {*} [defaultValue]
     * @returns {*} property by path or default value if absent
     */
    get : function get(context, path, defaultValue) {
        if (typeof path === 'undefined' || path === '') {
            return context;
        }

        var props = path.split('.'),
            prop = props[0],
            i, size,
            ctx = context;

        for (i = 0, size = props.length; i < size; prop = props[++i]) {
            if (typeof ctx === 'undefined' || ctx === null ||
                ! Object.prototype.hasOwnProperty.call(ctx, prop)) {
                return defaultValue;
            }

            ctx = ctx[prop];
        }

        return ctx;
    },

    /**
     * @param {*} context
     * @param {String} [path]
     * @returns {Boolean} `true` if property exists
     */
    has : function has(context, path) {
        if (typeof path === 'undefined' || path === '') {
            return context;
        }

        var props = path.split('.'),
            prop = props[0],
            i, size,
            ctx = context;

        for (i = 0, size = props.length; i < size; prop = props[++i]) {
            if (typeof ctx === 'undefined' || ctx === null ||
                ! Object.prototype.hasOwnProperty.call(ctx, prop)) {
                return false;
            }

            ctx = ctx[prop];
        }

        return true;
    }
};