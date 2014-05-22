var ou = require('./object_utils'),
    EventEmitterEx = require('./event_emitter_ex'),
    Configuration = require('./configuration'),
    LusterConfigurationError = require('./errors').LusterConfigurationError;

/**
 * @typedef {Object} PropertyCheck
 * @property {Boolean} required default: `false`
 * @property {String|String[]} type `typeOf()` result
 */

/**
 * Hash of configuration properties checks.
 * Keys are properties paths, values – checks descriptors.
 *
 * @const
 * @type {Object}
 * @property {PropertyCheck} *
 */
var CHECKS = {
    // path to worker main module
    'app' : { required : true, type : 'string' },
    // number of workers to spawn
    'workers' : { type : 'number' },

    // time (in ms) to wait for `online` event from worker
    'control.forkTimeout' : { type : 'number' },
    // time (in ms) to wait for `exit` event from worker after `disconnect`
    'control.stopTimeout' : { type : 'number' },
    // if worker dies in `threshold` ms then it's restarts counter increased
    'control.exitThreshold' : { type : 'number' },
    // allowed restarts before mark worker as dead
    'control.allowedSequentialDeaths' : { type : 'number' },

    // initial port for workers
    'server.port' : { type : [ 'number', 'string' ] },
    // increase port for every group
    'server.groups' : { type : 'number' },

    // every worker has unique debug port (debug.port + worker number)
    'debug.port' : { type : 'number' },

    // hash of extensions; keys – modules' names, values – extensions' configs
    'extensions' : { type : 'object' },
    // path to node_modules directory which contains extensions
    // configuration directory used by default
    'extensionsPath' : { type : 'string' }
};

/**
 * @param {String} path to property
 * @param {*} value
 * @param {PropertyCheck} check value description
 * @throws {LusterConfigurationError} if property check has been failed
 */
function checkProperty(path, value, check) {
    var type = ou.typeOf(value),
        allowedTypes;

    // required property
    if (type === 'undefined') {
        if (check.required) {
            throw LusterConfigurationError.createError(
                LusterConfigurationError.CODES.PROP_REQUIRED,
                { property : path });
        } else {
            return;
        }
    }

    // allowed types
    allowedTypes = check.type && [].concat(check.type);
    if (allowedTypes && allowedTypes.indexOf(type) === -1) {
        throw LusterConfigurationError.createError(
            LusterConfigurationError.CODES.PROP_TYPE_CHECK_FAILED,
            {
                property : path,
                type : type,
                expected : allowedTypes.join(' or ')
            });
    }
}

/**
 * Validate configuration object using assertions described by CHECKS const.
 *
 * @see CHECKS
 * @param {Object} conf configuration object
 * @returns {Number} of failed checks
 */
function check(conf) {
    var failedChecks = 0;

    Object
        .keys(CHECKS)
        .forEach(function(path) {
            // @todo avoid try..catch
            try {
                checkProperty(path, ou.get(conf, path), CHECKS[path]);
            } catch (error) {
                LusterConfigurationError.ensureError(error).log();
                ++failedChecks;
            }
        });

    return failedChecks;
}

/**
 * Override config properties using `LUSTER_CONF` environment variable.
 *
 * @description
 *      LUSTER_CONF='PATH=VALUE;...'
 *
 *      ; – properties separator;
 *      = – property and value separator;
 *      PATH – property path;
 *      VALUE – property value, JSON.parse applied to it,
 *          if JSON.parse failed, then value used as string.
 *          You MUST quote a string if it contains semicolon.
 *
 *      Spaces between PATH, "=", ";" and VALUE are insignificant.
 *
 * @example
 *      LUSTER_CONF='server.port=8080'
 *        # { server : { port : 8080 } }
 *
 *      LUSTER_CONF='app=./worker_debug.js; workers=1'
 *        # { app : "./worker_debug.js", workers : 1 }
 *
 *      LUSTER_CONF='logStream='
 *        # remove option "logStream"
 *
 *      LUSTER_CONF='server={"port":8080}'
 *        # { server : { port : 8080 } }
 *
 * @param {Object} config
 * @throws {LusterConfigurationError} if you trying to
 *      set property of atomic property, for example,
 *      error will be thrown if you have property
 *      `extensions.sample.x = 10` in the configuration and
 *      environment variable `LUSTER_EXTENSIONS_SAMPLE_X_Y=5`
 */
function applyEnvironment(config) {
    if ( ! process.env.LUSTER_CONF) {
        return;
    }

    function parseProp(prop) {
        var delimiterPos = prop.indexOf('='),
            propPath,
            propValue;

        if (delimiterPos === 0 || delimiterPos === -1) {
            return;
        }

        propPath = prop.substr(0, delimiterPos).trim();
        propValue = prop.substr(delimiterPos + 1).trim();

        if (propValue === '') {
            propValue = undefined;
        } else {
            try {
                // try to parse propValue as JSON,
                // if parsing failed use raw `propValue` as string
                propValue = JSON.parse(propValue);
            } catch(error) {
            }
        }

        ou.set(config, propPath, propValue);
    }

    var conf = process.env.LUSTER_CONF,
        lastSeparator = -1,
        i = 0,
        openQuote = false;

    while (conf.length > i++) {
        switch (conf[i]) {
        case '"' :
            openQuote = ! openQuote;
            break;
        case ';' :
            if ( ! openQuote) {
                parseProp(conf.substring(lastSeparator + 1, i));
                lastSeparator = i;
            }
        }
    }

    if (lastSeparator < conf.length) {
        parseProp(conf.substring(lastSeparator + 1));
    }
}

/**
 * @constructor
 * @class Configurable
 * @augments EventEmitterEx
 */
var Configurable = EventEmitterEx.create();

/**
 * Base directory used by Configuration#resolve().
 *
 * @type {String}
 * @static
 * @private
 */
Configurable.prototype._resolveBaseDir = process.cwd();

/**
 * Create Configuration instance from plain object.
 *
 * @param {Object} rawObject
 * @returns {Configuration} Configuration instance
 * @public
 */
Configurable.prototype.buildConfiguration = function(rawObject) {
    return new Configuration(ou.typeOf(rawObject) === 'object' ? rawObject : {}, this._resolveBaseDir);
};

/**
 * @event Configurable#configured
 */

/**
 * @param {Object} config
 * @param {Boolean} [applyEnv=true]
 * @param {String} [basedir=process.cwd()] for Configuration#resolve relative paths
 * @returns {Configurable} this
 * @throws {LusterConfigurationError} if configuration check failed (check errors will be logged to STDERR)
 * @fires Configurable#configured
 * @public
 */
Configurable.prototype.configure = function(config, applyEnv, basedir) {
    if (typeof applyEnv === 'undefined' || applyEnv) {
        applyEnvironment(config);
    }

    if (basedir) {
        /** @private */
        this._resolveBaseDir = basedir;
    }

    if (check(config) > 0) {
        this.emit('error',
            LusterConfigurationError.createError(
                LusterConfigurationError.CODES.CONFIGURATION_CHECK_FAILED));
    } else {
        /** @public */
        this.config = this.buildConfiguration(config);

        // hack to tweak underlying EventEmitter max listeners
        // if your luster-based app extensively use luster events
        this.setMaxListeners(this.config.get('maxEventListeners', 100));

        this.emit('configured');
    }

    return this;
};

module.exports = Configurable;
