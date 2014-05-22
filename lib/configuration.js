var path = require('path'),
    ou = require('./object_utils');

/**
 * @constructor
 * @class Configuration
 */
function Configuration(config, basedir) {
    /** @private */
    this._resolveBaseDir = basedir || process.cwd();

    /** @private */
    this._data = {};

    Object
        .keys(config)
        .forEach(function(propName) {
            this._data[propName] = config[propName];
        }, this);
}

/**
 * @param {String} path
 * @param {*} [defaultValue]
 * @returns {*}
 * @see get
 * @public
 */
Configuration.prototype.get = function(path, defaultValue) {
    return ou.get(this._data, path, defaultValue);
};

/**
 * @param {String} path
 * @returns {Boolean}
 * @see has
 * @public
 */
Configuration.prototype.has = function(path) {
    return ou.has(this._data, path);
};

/**
 * Shortcut for `Object.keys(c.get('some.obj.prop', {}))`
 * @param {String} [path]
 * @returns {String[]} keys of object property by path or
 *      empty array if property doesn't exists or not an object
 * @public
 */
Configuration.prototype.getKeys = function(path) {
    var obj = ou.get(this._data, path);

    if (ou.typeOf(obj) !== 'object') {
        return [];
    } else {
        return Object.keys(obj);
    }
};

/**
 * Shortcut for `path.resolve(process.cwd(), c.get(path, 'default.file'))`
 * @param {String} propPath
 * @param {String} [defaultPath]
 * @returns {String} absolute path
 * @public
 */
Configuration.prototype.resolve = function(propPath, defaultPath) {
    return path.resolve(
        this._resolveBaseDir,
        ou.get(this._data, propPath, defaultPath));
};

/**
 * If property has the type 'string', then it used as a path
 * (relative to resolve base, process.cwd()) for configuration,
 * else property value returned as is.
 *
 * @param {String} propPath
 * @return {Object} configuration object or `null` if property is not exists
 * @public
 */
Configuration.prototype.getSubConfig = function(propPath) {
    var _conf = this.get(propPath, null);

    if (typeof _conf === 'string') {
        _conf = this.resolve(propPath);

        // replace path with new instance of Configuration and return it
        return ou.set(this._data, propPath, new Configuration(require(_conf), path.dirname(_conf)));
    } else {
        return _conf;
    }
};

module.exports = Configuration;
