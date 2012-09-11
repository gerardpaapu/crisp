var require = function (file, cwd) {
    var resolved = require.resolve(file, cwd || '/');
    var mod = require.modules[resolved];
    if (!mod) throw new Error(
        'Failed to resolve module ' + file + ', tried ' + resolved
    );
    var res = mod._cached ? mod._cached : mod();
    return res;
}

require.paths = [];
require.modules = {};
require.extensions = [".js",".coffee"];

require._core = {
    'assert': true,
    'events': true,
    'fs': true,
    'path': true,
    'vm': true
};

require.resolve = (function () {
    return function (x, cwd) {
        if (!cwd) cwd = '/';
        
        if (require._core[x]) return x;
        var path = require.modules.path();
        cwd = path.resolve('/', cwd);
        var y = cwd || '/';
        
        if (x.match(/^(?:\.\.?\/|\/)/)) {
            var m = loadAsFileSync(path.resolve(y, x))
                || loadAsDirectorySync(path.resolve(y, x));
            if (m) return m;
        }
        
        var n = loadNodeModulesSync(x, y);
        if (n) return n;
        
        throw new Error("Cannot find module '" + x + "'");
        
        function loadAsFileSync (x) {
            if (require.modules[x]) {
                return x;
            }
            
            for (var i = 0; i < require.extensions.length; i++) {
                var ext = require.extensions[i];
                if (require.modules[x + ext]) return x + ext;
            }
        }
        
        function loadAsDirectorySync (x) {
            x = x.replace(/\/+$/, '');
            var pkgfile = x + '/package.json';
            if (require.modules[pkgfile]) {
                var pkg = require.modules[pkgfile]();
                var b = pkg.browserify;
                if (typeof b === 'object' && b.main) {
                    var m = loadAsFileSync(path.resolve(x, b.main));
                    if (m) return m;
                }
                else if (typeof b === 'string') {
                    var m = loadAsFileSync(path.resolve(x, b));
                    if (m) return m;
                }
                else if (pkg.main) {
                    var m = loadAsFileSync(path.resolve(x, pkg.main));
                    if (m) return m;
                }
            }
            
            return loadAsFileSync(x + '/index');
        }
        
        function loadNodeModulesSync (x, start) {
            var dirs = nodeModulesPathsSync(start);
            for (var i = 0; i < dirs.length; i++) {
                var dir = dirs[i];
                var m = loadAsFileSync(dir + '/' + x);
                if (m) return m;
                var n = loadAsDirectorySync(dir + '/' + x);
                if (n) return n;
            }
            
            var m = loadAsFileSync(x);
            if (m) return m;
        }
        
        function nodeModulesPathsSync (start) {
            var parts;
            if (start === '/') parts = [ '' ];
            else parts = path.normalize(start).split('/');
            
            var dirs = [];
            for (var i = parts.length - 1; i >= 0; i--) {
                if (parts[i] === 'node_modules') continue;
                var dir = parts.slice(0, i + 1).join('/') + '/node_modules';
                dirs.push(dir);
            }
            
            return dirs;
        }
    };
})();

require.alias = function (from, to) {
    var path = require.modules.path();
    var res = null;
    try {
        res = require.resolve(from + '/package.json', '/');
    }
    catch (err) {
        res = require.resolve(from, '/');
    }
    var basedir = path.dirname(res);
    
    var keys = (Object.keys || function (obj) {
        var res = [];
        for (var key in obj) res.push(key)
        return res;
    })(require.modules);
    
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.slice(0, basedir.length + 1) === basedir + '/') {
            var f = key.slice(basedir.length);
            require.modules[to + f] = require.modules[basedir + f];
        }
        else if (key === basedir) {
            require.modules[to] = require.modules[basedir];
        }
    }
};

require.define = function (filename, fn) {
    var dirname = require._core[filename]
        ? ''
        : require.modules.path().dirname(filename)
    ;
    
    var require_ = function (file) {
        return require(file, dirname)
    };
    require_.resolve = function (name) {
        return require.resolve(name, dirname);
    };
    require_.modules = require.modules;
    require_.define = require.define;
    var module_ = { exports : {} };
    
    require.modules[filename] = function () {
        require.modules[filename]._cached = module_.exports;
        fn.call(
            module_.exports,
            require_,
            module_,
            module_.exports,
            dirname,
            filename
        );
        require.modules[filename]._cached = module_.exports;
        return module_.exports;
    };
};

if (typeof process === 'undefined') process = {};

if (!process.nextTick) process.nextTick = (function () {
    var queue = [];
    var canPost = typeof window !== 'undefined'
        && window.postMessage && window.addEventListener
    ;
    
    if (canPost) {
        window.addEventListener('message', function (ev) {
            if (ev.source === window && ev.data === 'browserify-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);
    }
    
    return function (fn) {
        if (canPost) {
            queue.push(fn);
            window.postMessage('browserify-tick', '*');
        }
        else setTimeout(fn, 0);
    };
})();

if (!process.title) process.title = 'browser';

if (!process.binding) process.binding = function (name) {
    if (name === 'evals') return require('vm')
    else throw new Error('No such module')
};

if (!process.cwd) process.cwd = function () { return '.' };

require.define("path", function (require, module, exports, __dirname, __filename) {
function filter (xs, fn) {
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (fn(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length; i >= 0; i--) {
    var last = parts[i];
    if (last == '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Regex to split a filename into [*, dir, basename, ext]
// posix version
var splitPathRe = /^(.+\/(?!$)|\/)?((?:.+?)?(\.[^.]*)?)$/;

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
var resolvedPath = '',
    resolvedAbsolute = false;

for (var i = arguments.length; i >= -1 && !resolvedAbsolute; i--) {
  var path = (i >= 0)
      ? arguments[i]
      : process.cwd();

  // Skip empty and invalid entries
  if (typeof path !== 'string' || !path) {
    continue;
  }

  resolvedPath = path + '/' + resolvedPath;
  resolvedAbsolute = path.charAt(0) === '/';
}

// At this point the path should be resolved to a full absolute path, but
// handle relative paths to be safe (might happen when process.cwd() fails)

// Normalize the path
resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
var isAbsolute = path.charAt(0) === '/',
    trailingSlash = path.slice(-1) === '/';

// Normalize the path
path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }
  
  return (isAbsolute ? '/' : '') + path;
};


// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    return p && typeof p === 'string';
  }).join('/'));
};


exports.dirname = function(path) {
  var dir = splitPathRe.exec(path)[1] || '';
  var isWindows = false;
  if (!dir) {
    // No dirname
    return '.';
  } else if (dir.length === 1 ||
      (isWindows && dir.length <= 3 && dir.charAt(1) === ':')) {
    // It is just a slash or a drive letter with a slash
    return dir;
  } else {
    // It is a full dirname, strip trailing slash
    return dir.substring(0, dir.length - 1);
  }
};


exports.basename = function(path, ext) {
  var f = splitPathRe.exec(path)[2] || '';
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPathRe.exec(path)[3] || '';
};

});

require.define("/evaluate.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var Environment, Primitive, evalArray, evaluate, isArray, isBoolean, isFunction, isMacro, isNull, isNumber, isPrimitive, isReference, isSelfEvaluating, isString, isSymbol, isUndefined, _ref;
  var __slice = Array.prototype.slice;

  _ref = require('./types'), isNumber = _ref.isNumber, isString = _ref.isString, isBoolean = _ref.isBoolean, isFunction = _ref.isFunction, isArray = _ref.isArray, isNull = _ref.isNull, isUndefined = _ref.isUndefined, isSymbol = _ref.isSymbol, isMacro = _ref.isMacro, isPrimitive = _ref.isPrimitive, isReference = _ref.isReference;

  Primitive = require('./primitive').Primitive;

  Environment = require('./environment').Environment;

  evaluate = function(stx, env) {
    if (isSelfEvaluating(stx)) {
      return stx;
    } else if (isReference(stx)) {
      return stx.value;
    } else if (isSymbol(stx)) {
      return env.lookup(stx);
    } else if (isArray(stx)) {
      return evalArray(stx, env);
    } else {
      throw new Error("Can't evaluate " + stx);
    }
  };

  evalArray = function(stx, env) {
    var head, operands, operator, tail;
    head = stx[0], tail = 2 <= stx.length ? __slice.call(stx, 1) : [];
    operator = evaluate(head, env);
    if (isMacro(operator)) {
      return evaluate(operator.expand(tail, env), env);
    } else if (isPrimitive(operator)) {
      return operator.run(tail, env, evaluate);
    } else if (isFunction(operator)) {
      operands = tail.map(function(t) {
        return evaluate(t, env);
      });
      return operator.apply(env.context, operands);
    } else {
      throw new Error("Bad operator: " + operator);
    }
  };

  isSelfEvaluating = function(stx) {
    return isString(stx) || isNumber(stx) || isBoolean(stx) || isNull(stx) || isUndefined(stx);
  };

  module.exports.evaluate = evaluate;

  module.exports.eval = new Primitive(function(stx, env, evaluate) {
    return evaluate(evaluate(stx, env), env);
  });

  console.log('evaluate.coffee');

}).call(this);

});

require.define("/types.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var Macro, Primitive, Reference, Symbol;

  Macro = require('./macro').Macro;

  Symbol = require('./symbol').Symbol;

  Primitive = require('./primitive').Primitive;

  Reference = require('./reference').Reference;

  module.exports = {
    isFunction: function(obj) {
      return Object.prototype.toString.call(obj) === '[object Function]';
    },
    isArray: function(obj) {
      return Object.prototype.toString.call(obj) === '[object Array]';
    },
    isNumber: function(obj) {
      return Object.prototype.toString.call(obj) === '[object Number]';
    },
    isBoolean: function(obj) {
      return Object.prototype.toString.call(obj) === '[object Boolean]';
    },
    isString: function(obj) {
      return Object.prototype.toString.call(obj) === '[object String]';
    },
    isNull: function(obj) {
      return obj === null;
    },
    isUndefined: function(obj) {
      return obj === void 0;
    },
    isMacro: function(obj) {
      return obj instanceof Macro;
    },
    isSymbol: function(obj) {
      return obj instanceof Symbol;
    },
    isPrimitive: function(obj) {
      return obj instanceof Primitive;
    },
    isReference: function(obj) {
      return obj instanceof Reference;
    }
  };

  console.log('types.coffee');

}).call(this);

});

require.define("/macro.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var Macro, Primitive, assert, isFunction, macro;

  Primitive = require('./primitive').Primitive;

  isFunction = require('./types').isFunction;

  assert = require('assert');

  Macro = (function() {

    function Macro(operator) {
      this.operator = operator;
    }

    Macro.prototype.expand = function(stx, env) {
      return this.operator.call(null, stx, env);
    };

    return Macro;

  })();

  macro = new Primitive(function(stx, env, evaluate) {
    var operator;
    assert.equal(stx.length, 1, "macro takes exactly one argument");
    operator = evaluate(stx[0], env);
    assert.ok(isFunction(operator));
    return new Macro(operator);
  });

  module.exports.Macro = Macro;

  module.exports.macro = macro;

  console.log('macro.coffee');

}).call(this);

});

require.define("/primitive.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var Primitive;

  Primitive = (function() {

    function Primitive(operator) {
      this.operator = operator;
    }

    Primitive.prototype.run = function(stx, env, evaluate) {
      return this.operator.call(null, stx, env, evaluate);
    };

    return Primitive;

  })();

  module.exports.Primitive = Primitive;

}).call(this);

});

require.define("assert", function (require, module, exports, __dirname, __filename) {
// UTILITY
var util = require('util');
var pSlice = Array.prototype.slice;

// 1. The assert module provides functions that throw
// AssertionError's when particular conditions are not met. The
// assert module must conform to the following interface.

var assert = module.exports = ok;

// 2. The AssertionError is defined in assert.
// new assert.AssertionError({ message: message,
//                             actual: actual,
//                             expected: expected })

assert.AssertionError = function AssertionError(options) {
  this.name = 'AssertionError';
  this.message = options.message;
  this.actual = options.actual;
  this.expected = options.expected;
  this.operator = options.operator;
  var stackStartFunction = options.stackStartFunction || fail;

  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, stackStartFunction);
  }
};
util.inherits(assert.AssertionError, Error);

function replacer(key, value) {
  if (value === undefined) {
    return '' + value;
  }
  if (typeof value === 'number' && (isNaN(value) || !isFinite(value))) {
    return value.toString();
  }
  if (typeof value === 'function' || value instanceof RegExp) {
    return value.toString();
  }
  return value;
}

function truncate(s, n) {
  if (typeof s == 'string') {
    return s.length < n ? s : s.slice(0, n);
  } else {
    return s;
  }
}

assert.AssertionError.prototype.toString = function() {
  if (this.message) {
    return [this.name + ':', this.message].join(' ');
  } else {
    return [
      this.name + ':',
      truncate(JSON.stringify(this.actual, replacer), 128),
      this.operator,
      truncate(JSON.stringify(this.expected, replacer), 128)
    ].join(' ');
  }
};

// assert.AssertionError instanceof Error

assert.AssertionError.__proto__ = Error.prototype;

// At present only the three keys mentioned above are used and
// understood by the spec. Implementations or sub modules can pass
// other keys to the AssertionError's constructor - they will be
// ignored.

// 3. All of the following functions must throw an AssertionError
// when a corresponding condition is not met, with a message that
// may be undefined if not provided.  All assertion methods provide
// both the actual and expected values to the assertion error for
// display purposes.

function fail(actual, expected, message, operator, stackStartFunction) {
  throw new assert.AssertionError({
    message: message,
    actual: actual,
    expected: expected,
    operator: operator,
    stackStartFunction: stackStartFunction
  });
}

// EXTENSION! allows for well behaved errors defined elsewhere.
assert.fail = fail;

// 4. Pure assertion tests whether a value is truthy, as determined
// by !!guard.
// assert.ok(guard, message_opt);
// This statement is equivalent to assert.equal(true, guard,
// message_opt);. To test strictly for the value true, use
// assert.strictEqual(true, guard, message_opt);.

function ok(value, message) {
  if (!!!value) fail(value, true, message, '==', assert.ok);
}
assert.ok = ok;

// 5. The equality assertion tests shallow, coercive equality with
// ==.
// assert.equal(actual, expected, message_opt);

assert.equal = function equal(actual, expected, message) {
  if (actual != expected) fail(actual, expected, message, '==', assert.equal);
};

// 6. The non-equality assertion tests for whether two objects are not equal
// with != assert.notEqual(actual, expected, message_opt);

assert.notEqual = function notEqual(actual, expected, message) {
  if (actual == expected) {
    fail(actual, expected, message, '!=', assert.notEqual);
  }
};

// 7. The equivalence assertion tests a deep equality relation.
// assert.deepEqual(actual, expected, message_opt);

assert.deepEqual = function deepEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected)) {
    fail(actual, expected, message, 'deepEqual', assert.deepEqual);
  }
};

function _deepEqual(actual, expected) {
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;

  } else if (Buffer.isBuffer(actual) && Buffer.isBuffer(expected)) {
    if (actual.length != expected.length) return false;

    for (var i = 0; i < actual.length; i++) {
      if (actual[i] !== expected[i]) return false;
    }

    return true;

  // 7.2. If the expected value is a Date object, the actual value is
  // equivalent if it is also a Date object that refers to the same time.
  } else if (actual instanceof Date && expected instanceof Date) {
    return actual.getTime() === expected.getTime();

  // 7.3. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if (typeof actual != 'object' && typeof expected != 'object') {
    return actual == expected;

  // 7.4. For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else {
    return objEquiv(actual, expected);
  }
}

function isUndefinedOrNull(value) {
  return value === null || value === undefined;
}

function isArguments(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}

function objEquiv(a, b) {
  if (isUndefinedOrNull(a) || isUndefinedOrNull(b))
    return false;
  // an identical 'prototype' property.
  if (a.prototype !== b.prototype) return false;
  //~~~I've managed to break Object.keys through screwy arguments passing.
  //   Converting to array solves the problem.
  if (isArguments(a)) {
    if (!isArguments(b)) {
      return false;
    }
    a = pSlice.call(a);
    b = pSlice.call(b);
    return _deepEqual(a, b);
  }
  try {
    var ka = Object.keys(a),
        kb = Object.keys(b),
        key, i;
  } catch (e) {//happens when one is a string literal and the other isn't
    return false;
  }
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length != kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!_deepEqual(a[key], b[key])) return false;
  }
  return true;
}

// 8. The non-equivalence assertion tests for any deep inequality.
// assert.notDeepEqual(actual, expected, message_opt);

assert.notDeepEqual = function notDeepEqual(actual, expected, message) {
  if (_deepEqual(actual, expected)) {
    fail(actual, expected, message, 'notDeepEqual', assert.notDeepEqual);
  }
};

// 9. The strict equality assertion tests strict equality, as determined by ===.
// assert.strictEqual(actual, expected, message_opt);

assert.strictEqual = function strictEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(actual, expected, message, '===', assert.strictEqual);
  }
};

// 10. The strict non-equality assertion tests for strict inequality, as
// determined by !==.  assert.notStrictEqual(actual, expected, message_opt);

assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
  if (actual === expected) {
    fail(actual, expected, message, '!==', assert.notStrictEqual);
  }
};

function expectedException(actual, expected) {
  if (!actual || !expected) {
    return false;
  }

  if (expected instanceof RegExp) {
    return expected.test(actual);
  } else if (actual instanceof expected) {
    return true;
  } else if (expected.call({}, actual) === true) {
    return true;
  }

  return false;
}

function _throws(shouldThrow, block, expected, message) {
  var actual;

  if (typeof expected === 'string') {
    message = expected;
    expected = null;
  }

  try {
    block();
  } catch (e) {
    actual = e;
  }

  message = (expected && expected.name ? ' (' + expected.name + ').' : '.') +
            (message ? ' ' + message : '.');

  if (shouldThrow && !actual) {
    fail('Missing expected exception' + message);
  }

  if (!shouldThrow && expectedException(actual, expected)) {
    fail('Got unwanted exception' + message);
  }

  if ((shouldThrow && actual && expected &&
      !expectedException(actual, expected)) || (!shouldThrow && actual)) {
    throw actual;
  }
}

// 11. Expected to throw an error:
// assert.throws(block, Error_opt, message_opt);

assert.throws = function(block, /*optional*/error, /*optional*/message) {
  _throws.apply(this, [true].concat(pSlice.call(arguments)));
};

// EXTENSION! This is annoying to write outside this module.
assert.doesNotThrow = function(block, /*optional*/error, /*optional*/message) {
  _throws.apply(this, [false].concat(pSlice.call(arguments)));
};

assert.ifError = function(err) { if (err) {throw err;}};

});

require.define("util", function (require, module, exports, __dirname, __filename) {
var events = require('events');

exports.print = function () {};
exports.puts = function () {};
exports.debug = function() {};

exports.inspect = function(obj, showHidden, depth, colors) {
  var seen = [];

  var stylize = function(str, styleType) {
    // http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
    var styles =
        { 'bold' : [1, 22],
          'italic' : [3, 23],
          'underline' : [4, 24],
          'inverse' : [7, 27],
          'white' : [37, 39],
          'grey' : [90, 39],
          'black' : [30, 39],
          'blue' : [34, 39],
          'cyan' : [36, 39],
          'green' : [32, 39],
          'magenta' : [35, 39],
          'red' : [31, 39],
          'yellow' : [33, 39] };

    var style =
        { 'special': 'cyan',
          'number': 'blue',
          'boolean': 'yellow',
          'undefined': 'grey',
          'null': 'bold',
          'string': 'green',
          'date': 'magenta',
          // "name": intentionally not styling
          'regexp': 'red' }[styleType];

    if (style) {
      return '\033[' + styles[style][0] + 'm' + str +
             '\033[' + styles[style][1] + 'm';
    } else {
      return str;
    }
  };
  if (! colors) {
    stylize = function(str, styleType) { return str; };
  }

  function format(value, recurseTimes) {
    // Provide a hook for user-specified inspect functions.
    // Check that value is an object with an inspect function on it
    if (value && typeof value.inspect === 'function' &&
        // Filter out the util module, it's inspect function is special
        value !== exports &&
        // Also filter out any prototype objects using the circular check.
        !(value.constructor && value.constructor.prototype === value)) {
      return value.inspect(recurseTimes);
    }

    // Primitive types cannot have properties
    switch (typeof value) {
      case 'undefined':
        return stylize('undefined', 'undefined');

      case 'string':
        var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                                 .replace(/'/g, "\\'")
                                                 .replace(/\\"/g, '"') + '\'';
        return stylize(simple, 'string');

      case 'number':
        return stylize('' + value, 'number');

      case 'boolean':
        return stylize('' + value, 'boolean');
    }
    // For some reason typeof null is "object", so special case here.
    if (value === null) {
      return stylize('null', 'null');
    }

    // Look up the keys of the object.
    var visible_keys = Object_keys(value);
    var keys = showHidden ? Object_getOwnPropertyNames(value) : visible_keys;

    // Functions without properties can be shortcutted.
    if (typeof value === 'function' && keys.length === 0) {
      if (isRegExp(value)) {
        return stylize('' + value, 'regexp');
      } else {
        var name = value.name ? ': ' + value.name : '';
        return stylize('[Function' + name + ']', 'special');
      }
    }

    // Dates without properties can be shortcutted
    if (isDate(value) && keys.length === 0) {
      return stylize(value.toUTCString(), 'date');
    }

    var base, type, braces;
    // Determine the object type
    if (isArray(value)) {
      type = 'Array';
      braces = ['[', ']'];
    } else {
      type = 'Object';
      braces = ['{', '}'];
    }

    // Make functions say that they are functions
    if (typeof value === 'function') {
      var n = value.name ? ': ' + value.name : '';
      base = (isRegExp(value)) ? ' ' + value : ' [Function' + n + ']';
    } else {
      base = '';
    }

    // Make dates with properties first say the date
    if (isDate(value)) {
      base = ' ' + value.toUTCString();
    }

    if (keys.length === 0) {
      return braces[0] + base + braces[1];
    }

    if (recurseTimes < 0) {
      if (isRegExp(value)) {
        return stylize('' + value, 'regexp');
      } else {
        return stylize('[Object]', 'special');
      }
    }

    seen.push(value);

    var output = keys.map(function(key) {
      var name, str;
      if (value.__lookupGetter__) {
        if (value.__lookupGetter__(key)) {
          if (value.__lookupSetter__(key)) {
            str = stylize('[Getter/Setter]', 'special');
          } else {
            str = stylize('[Getter]', 'special');
          }
        } else {
          if (value.__lookupSetter__(key)) {
            str = stylize('[Setter]', 'special');
          }
        }
      }
      if (visible_keys.indexOf(key) < 0) {
        name = '[' + key + ']';
      }
      if (!str) {
        if (seen.indexOf(value[key]) < 0) {
          if (recurseTimes === null) {
            str = format(value[key]);
          } else {
            str = format(value[key], recurseTimes - 1);
          }
          if (str.indexOf('\n') > -1) {
            if (isArray(value)) {
              str = str.split('\n').map(function(line) {
                return '  ' + line;
              }).join('\n').substr(2);
            } else {
              str = '\n' + str.split('\n').map(function(line) {
                return '   ' + line;
              }).join('\n');
            }
          }
        } else {
          str = stylize('[Circular]', 'special');
        }
      }
      if (typeof name === 'undefined') {
        if (type === 'Array' && key.match(/^\d+$/)) {
          return str;
        }
        name = JSON.stringify('' + key);
        if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
          name = name.substr(1, name.length - 2);
          name = stylize(name, 'name');
        } else {
          name = name.replace(/'/g, "\\'")
                     .replace(/\\"/g, '"')
                     .replace(/(^"|"$)/g, "'");
          name = stylize(name, 'string');
        }
      }

      return name + ': ' + str;
    });

    seen.pop();

    var numLinesEst = 0;
    var length = output.reduce(function(prev, cur) {
      numLinesEst++;
      if (cur.indexOf('\n') >= 0) numLinesEst++;
      return prev + cur.length + 1;
    }, 0);

    if (length > 50) {
      output = braces[0] +
               (base === '' ? '' : base + '\n ') +
               ' ' +
               output.join(',\n  ') +
               ' ' +
               braces[1];

    } else {
      output = braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
    }

    return output;
  }
  return format(obj, (typeof depth === 'undefined' ? 2 : depth));
};


function isArray(ar) {
  return ar instanceof Array ||
         Array.isArray(ar) ||
         (ar && ar !== Object.prototype && isArray(ar.__proto__));
}


function isRegExp(re) {
  return re instanceof RegExp ||
    (typeof re === 'object' && Object.prototype.toString.call(re) === '[object RegExp]');
}


function isDate(d) {
  if (d instanceof Date) return true;
  if (typeof d !== 'object') return false;
  var properties = Date.prototype && Object_getOwnPropertyNames(Date.prototype);
  var proto = d.__proto__ && Object_getOwnPropertyNames(d.__proto__);
  return JSON.stringify(proto) === JSON.stringify(properties);
}

function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}

var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}

exports.log = function (msg) {};

exports.pump = null;

var Object_keys = Object.keys || function (obj) {
    var res = [];
    for (var key in obj) res.push(key);
    return res;
};

var Object_getOwnPropertyNames = Object.getOwnPropertyNames || function (obj) {
    var res = [];
    for (var key in obj) {
        if (Object.hasOwnProperty.call(obj, key)) res.push(key);
    }
    return res;
};

var Object_create = Object.create || function (prototype, properties) {
    // from es5-shim
    var object;
    if (prototype === null) {
        object = { '__proto__' : null };
    }
    else {
        if (typeof prototype !== 'object') {
            throw new TypeError(
                'typeof prototype[' + (typeof prototype) + '] != \'object\''
            );
        }
        var Type = function () {};
        Type.prototype = prototype;
        object = new Type();
        object.__proto__ = prototype;
    }
    if (typeof properties !== 'undefined' && Object.defineProperties) {
        Object.defineProperties(object, properties);
    }
    return object;
};

exports.inherits = function(ctor, superCtor) {
  ctor.super_ = superCtor;
  ctor.prototype = Object_create(superCtor.prototype, {
    constructor: {
      value: ctor,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
};

});

require.define("events", function (require, module, exports, __dirname, __filename) {
if (!process.EventEmitter) process.EventEmitter = function () {};

var EventEmitter = exports.EventEmitter = process.EventEmitter;
var isArray = typeof Array.isArray === 'function'
    ? Array.isArray
    : function (xs) {
        return Object.toString.call(xs) === '[object Array]'
    }
;

// By default EventEmitters will print a warning if more than
// 10 listeners are added to it. This is a useful default which
// helps finding memory leaks.
//
// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
var defaultMaxListeners = 10;
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!this._events) this._events = {};
  this._events.maxListeners = n;
};


EventEmitter.prototype.emit = function(type) {
  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events || !this._events.error ||
        (isArray(this._events.error) && !this._events.error.length))
    {
      if (arguments[1] instanceof Error) {
        throw arguments[1]; // Unhandled 'error' event
      } else {
        throw new Error("Uncaught, unspecified 'error' event.");
      }
      return false;
    }
  }

  if (!this._events) return false;
  var handler = this._events[type];
  if (!handler) return false;

  if (typeof handler == 'function') {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        var args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
    return true;

  } else if (isArray(handler)) {
    var args = Array.prototype.slice.call(arguments, 1);

    var listeners = handler.slice();
    for (var i = 0, l = listeners.length; i < l; i++) {
      listeners[i].apply(this, args);
    }
    return true;

  } else {
    return false;
  }
};

// EventEmitter is defined in src/node_events.cc
// EventEmitter.prototype.emit() is also defined there.
EventEmitter.prototype.addListener = function(type, listener) {
  if ('function' !== typeof listener) {
    throw new Error('addListener only takes instances of Function');
  }

  if (!this._events) this._events = {};

  // To avoid recursion in the case that type == "newListeners"! Before
  // adding it to the listeners, first emit "newListeners".
  this.emit('newListener', type, listener);

  if (!this._events[type]) {
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  } else if (isArray(this._events[type])) {

    // Check for listener leak
    if (!this._events[type].warned) {
      var m;
      if (this._events.maxListeners !== undefined) {
        m = this._events.maxListeners;
      } else {
        m = defaultMaxListeners;
      }

      if (m && m > 0 && this._events[type].length > m) {
        this._events[type].warned = true;
        console.error('(node) warning: possible EventEmitter memory ' +
                      'leak detected. %d listeners added. ' +
                      'Use emitter.setMaxListeners() to increase limit.',
                      this._events[type].length);
        console.trace();
      }
    }

    // If we've already got an array, just append.
    this._events[type].push(listener);
  } else {
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  var self = this;
  self.on(type, function g() {
    self.removeListener(type, g);
    listener.apply(this, arguments);
  });

  return this;
};

EventEmitter.prototype.removeListener = function(type, listener) {
  if ('function' !== typeof listener) {
    throw new Error('removeListener only takes instances of Function');
  }

  // does not use listeners(), so no side effect of creating _events[type]
  if (!this._events || !this._events[type]) return this;

  var list = this._events[type];

  if (isArray(list)) {
    var i = list.indexOf(listener);
    if (i < 0) return this;
    list.splice(i, 1);
    if (list.length == 0)
      delete this._events[type];
  } else if (this._events[type] === listener) {
    delete this._events[type];
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  // does not use listeners(), so no side effect of creating _events[type]
  if (type && this._events && this._events[type]) this._events[type] = null;
  return this;
};

EventEmitter.prototype.listeners = function(type) {
  if (!this._events) this._events = {};
  if (!this._events[type]) this._events[type] = [];
  if (!isArray(this._events[type])) {
    this._events[type] = [this._events[type]];
  }
  return this._events[type];
};

});

require.define("/symbol.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var Symbol;

  Symbol = (function() {

    function Symbol(value) {
      this.value = value;
    }

    Symbol.prototype.toString = function() {
      return this.value;
    };

    return Symbol;

  })();

  module.exports.Symbol = Symbol;

  console.log('symbol.coffee');

}).call(this);

});

require.define("/reference.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var Reference;

  Reference = (function() {

    function Reference(value) {
      this.value = value;
    }

    return Reference;

  })();

  module.exports.Reference = Reference;

  console.log('reference.coffee');

}).call(this);

});

require.define("/environment.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var Environment;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  Environment = (function() {

    function Environment(parent) {
      var _ref;
      this.parent = parent;
      if ((_ref = this.parent) == null) this.parent = new Environment.Empty;
      this.table = {};
      this.context = null;
      this.arguments = null;
    }

    Environment.prototype.contains = function(key) {
      return this.table.hasOwnProperty(key) || this.parent.contains(key);
    };

    Environment.prototype.lookup = function(key) {
      if (this.table.hasOwnProperty(key)) {
        return this.table[key];
      } else {
        return this.parent.lookup(key);
      }
    };

    Environment.prototype.get = function(key, fallback) {
      if (this.contains(key)) {
        return this.lookup(key);
      } else {
        return fallback;
      }
    };

    Environment.prototype.set = function(key, value) {
      return this.table[key] = value;
    };

    Environment.prototype.extend = function(values) {
      var env, key, value;
      if (values == null) values = {};
      env = new Environment(this);
      for (key in values) {
        value = values[key];
        env.set(key, value);
      }
      return env;
    };

    Environment.prototype.bind = function(key, value) {
      return this.table[key] = value;
    };

    return Environment;

  })();

  Environment.Empty = (function() {

    __extends(Empty, Environment);

    function Empty() {}

    Empty.prototype.contains = function(key) {
      return false;
    };

    Empty.prototype.lookup = function(key) {
      throw new Error("" + key + " is undeclared");
    };

    return Empty;

  })();

  module.exports.Environment = Environment;

  console.log('environment.coffee');

}).call(this);

});

require.define("/function.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var Primitive, associate, _function;
  var __slice = Array.prototype.slice;

  Primitive = require('./primitive').Primitive;

  _function = new Primitive(function(stx, env, evaluate) {
    var args, body, result;
    args = stx[0], body = 2 <= stx.length ? __slice.call(stx, 1) : [];
    result = function() {
      var i;
      env = env.extend(associate(args, arguments));
      env.context = this;
      env.arguments = arguments;
      i = 0;
      while (i < body.length - 1) {
        evaluate(body[i++], env);
      }
      return evaluate(body[i], env);
    };
    return result;
  });

  associate = function(symbols, values) {
    var i, result, symbol, _len;
    result = {};
    for (i = 0, _len = symbols.length; i < _len; i++) {
      symbol = symbols[i];
      result[symbol.value] = values[i];
    }
    return result;
  };

  module.exports["function"] = _function;

  console.log('function.coffee');

}).call(this);

});

require.define("/definition.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var Primitive, Symbol, define, set;

  Primitive = require('./primitive.coffee').Primitive;

  Symbol = require('./symbol.coffee').Symbol;

  define = new Primitive(function(stx, env, evaluate) {
    var expr, place;
    place = stx[0], expr = stx[1];
    if (!(place instanceof Symbol)) throw new SyntaxError();
    if (env.contains(place.value)) {
      throw new Error("" + place.value + " already defined");
    }
    return env.set(place.value, evaluate(expr, env));
  });

  set = new Primitive(function(stx, env, evaluate) {
    var expr, place;
    place = stx[0], expr = stx[1];
    if (!(place instanceof Symbol)) throw new SyntaxError();
    if (!env.contains(place.value)) {
      throw new Error("" + place.value + " not defined");
    }
    return env.set(place.value, evaluate(expr, env));
  });

  exports.define = define;

  exports.set = set;

  console.log('definition.coffee');

}).call(this);

});

require.define("/reader.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var Port, Reader, Reference, Symbol, escape_table, quasiquote, quote, regexes, unquote, _function, _qausiquote, _quote, _ref, _unquote;

  Symbol = require('./symbol').Symbol;

  Reference = require('./reference').Reference;

  _function = new Reference(require('./function')["function"]);

  _ref = require('./quote'), quote = _ref.quote, quasiquote = _ref.quasiquote, unquote = _ref.unquote;

  _quote = new Reference(quote);

  _qausiquote = new Reference(quasiquote);

  _unquote = new Reference(unquote);

  regexes = {
    symbol: /[a-z-_+=!?^*<>&\/\\]+/,
    number: /-?(0|([1-9]\d*))(\.\d+)?((e|E)(\+|\-)\d+)?/
  };

  escape_table = {
    '"': '"',
    '\\': '\\',
    b: '\b',
    f: '\f',
    n: '\n',
    r: '\r',
    t: '\t'
  };

  Port = (function() {

    function Port(string, position) {
      this.string = string;
      this.position = position != null ? position : 0;
    }

    Port.prototype.position = 0;

    Port.prototype.line = 1;

    Port.prototype.column = 1;

    Port.prototype.clone = function() {
      return new Port(this.string, this.position);
    };

    Port.prototype.peek = function(n) {
      if (n == null) n = 1;
      if (this.position >= this.string.length) {
        return null;
      } else {
        return this.string.slice(this.position, this.position + n);
      }
    };

    Port.prototype.read = function(n) {
      var value;
      if (n == null) n = 1;
      value = this.peek(n);
      this.skip(n);
      return value;
    };

    Port.prototype.skip = function(n) {
      var segment;
      if (n == null) n = 1;
      segment = this.string.slice(this.position, this.position + n);
      this.line += segment.replace(/[^\n]/mg, '').length;
      this.col = segment.replace(/.*(\n.*)$/, '$1').length;
      return this.position += n;
    };

    Port.prototype.match = function(p) {
      var match, pattern, result, string;
      string = this.string.slice(this.position);
      pattern = new RegExp("^" + p.source);
      match = pattern.exec(string);
      if (match != null) {
        result = match[0];
        this.skip(result.length);
        return result;
      } else {
        return null;
      }
    };

    Port.prototype.test = function(p) {
      var pattern, string;
      string = this.string.slice(this.position);
      pattern = new RegExp("^" + p.source);
      return pattern.test(string);
    };

    Port.prototype.skipWhitespace = function() {
      return this.match(/(\s|,)+/);
    };

    Port.prototype.isEmpty = function() {
      return this.string.length <= this.position;
    };

    Port.prototype.report = function() {
      return "line: " + this.line + ", col: " + this.col;
    };

    return Port;

  })();

  Reader = (function() {

    function Reader(string) {
      this.port = new Port(string);
    }

    Reader.prototype.lookahead = function() {
      var name, pattern, _ref2;
      this.port.skipWhitespace();
      if (this.port.isEmpty()) return '<eof>';
      _ref2 = this.lookaheadTable();
      for (name in _ref2) {
        pattern = _ref2[name];
        if (this.port.test(pattern)) return name;
      }
      throw new Error("Unexpected character during lookahead " + (this.port.peek()) + " at " + (this.port.report()));
    };

    Reader.prototype.lookaheadTable = function() {
      return {
        number: regexes.number,
        symbol: regexes.symbol,
        '(': /\(/,
        ')': /\)/,
        '[': /\[/,
        ']': /\]/,
        '{': /\{/,
        '}': /\}/,
        string: /"/,
        'this': /\@/,
        'arguments': /%/,
        short_fun: /#/,
        quote: /'/,
        quasiquote: /`/,
        unquote: /~/,
        key: /:/
      };
    };

    Reader.prototype.read_sexps = function() {
      var _results;
      _results = [];
      while (this.lookahead() !== '<eof>') {
        _results.push(this.read_sexp());
      }
      return _results;
    };

    Reader.prototype.read_sexp = function() {
      var col, line, position, sexp, _ref2;
      position = (_ref2 = this.port, line = _ref2.line, col = _ref2.col, _ref2);
      sexp = (function() {
        switch (this.lookahead()) {
          case '(':
            return this.read_list();
          case '[':
            return this.read_array();
          case '{':
            return this.read_dict();
          case 'string':
            return this.read_string();
          case 'symbol':
            return this.read_symbol();
          case 'number':
            return this.read_number();
          case 'this':
            return this.read_this();
          case 'arguments':
            return this.read_arguments();
          case 'short_fun':
            return this.read_short_fun();
          case 'quote':
            return this.read_quote();
          case 'quasiquote':
            return this.read_quasiquote();
          case 'unquote':
            return this.read_unquote();
          case 'key':
            return this.read_key();
          case '<eof>':
            return null;
          default:
            throw new Error("Unexpected " + (this.port.peek()) + " at " + (this.port.report()));
        }
      }).call(this);
      return sexp;
    };

    Reader.prototype.read_list = function() {
      return this.read_brackets('(', ')');
    };

    Reader.prototype.read_array = function() {
      return [_("#array"), this.read_brackets('[', ']')];
    };

    Reader.prototype.read_dict = function() {
      return [_("#dictionary"), this.read_brackets('{', '}')];
    };

    Reader.prototype.read_brackets = function(start, stop) {
      var list;
      list = [];
      this.assert(start);
      while (this.lookahead() !== stop) {
        if (this.port.isEmpty()) throw new Error('Unexpected EOF');
        list.push(this.read_sexp());
      }
      this.assert(stop);
      return list;
    };

    Reader.prototype.assert = function(symbol) {
      if (this.lookahead() !== symbol) {
        throw new Error("Expected " + symbol + ", got " + (this.lookahead()) + " at " + (this.port.report()));
      }
      return this.port.skip();
    };

    Reader.prototype.read_number = function() {
      return Number(this.port.match(regexes.number));
    };

    Reader.prototype.read_arguments = function() {
      this.port.skip();
      if (/\d/.test(this.port.peek())) {
        return ["#arguments", Number(this.port.match(/\d+/))];
      } else {
        return ["#arguments", 0];
      }
    };

    Reader.prototype.read_this = function() {
      this.port.skip();
      return ["#this", this.read_symbol()];
    };

    Reader.prototype.read_quote = function() {
      this.port.skip();
      return [_quote, this.read_sexp()];
    };

    Reader.prototype.read_unquote = function() {
      this.port.skip();
      return [_unquote, this.read_sexp()];
    };

    Reader.prototype.read_quasiquote = function() {
      this.port.skip();
      return [_quasiquote, this.read_sexp()];
    };

    Reader.prototype.read_short_fun = function() {
      this.port.skip();
      return [_function, [], this.read_sexp()];
    };

    Reader.prototype.read_symbol = function() {
      return new Symbol(this.port.match(regexes.symbol));
    };

    Reader.prototype.read_key = function() {
      this.port.skip();
      return ["key", this.read_symbol()];
    };

    Reader.prototype.read_string = function(quote) {
      var code, code_point, end, str, _results;
      if (quote == null) quote = '"';
      str = "";
      end = false;
      this.port.skip(quote);
      _results = [];
      while (this.port.peek() !== quote) {
        switch (this.port.peek()) {
          case null:
            throw new Error("Unexpected EOF in '" + str + "'");
            break;
          case '\\':
            this.port.skip();
            code = this.port.read();
            if (code === 'u') {
              code_point = parseInt(this.port.read(4), 16);
              _results.push(str += String.fromCharCode(code_point));
            } else {
              _results.push(str += escape_table[code]);
            }
            break;
          case '"':
            this.port.skip();
            return str;
          default:
            _results.push(str += this.port.read());
        }
      }
      return _results;
    };

    return Reader;

  })();

  exports.read = function(string) {
    return new Reader(string).read_sexps();
  };

  exports.readOne = function(string) {
    return new Reader(string).read_sexp();
  };

  exports.Port = Port;

  exports.Reader = Reader;

  console.log('reader.coffee');

}).call(this);

});

require.define("/quote.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var Macro, Primitive, Reference, isArray, isUnquoted, quasiquote, quote, unquote;

  Macro = require('./macro').Macro;

  Reference = require('./reference').Reference;

  isArray = require('./types').isArray;

  Primitive = require('./primitive').Primitive;

  quote = new Primitive(function(body, env, evaluate) {
    if (body.length !== 1) throw new SyntaxError;
    return body[0];
  });

  quasiquote = new Macro(function(body, env) {
    var stx, _i, _len, _results;
    _results = [];
    for (_i = 0, _len = body.length; _i < _len; _i++) {
      stx = body[_i];
      if (isUnquoted(stx, env)) {
        _results.push(stx.slice(1));
      } else {
        _results.push([new Reference(quote), stx]);
      }
    }
    return _results;
  });

  unquote = new Macro(function(body, env) {
    throw new Error("Unquote should only be inside a quasiquote");
  });

  isUnquoted = function(stx, env) {
    return isArray(stx) && stx.length > 0 && env.get(stx[0], null) === unquote;
  };

  module.exports = {
    quote: quote,
    quasiquote: quasiquote,
    unquote: unquote
  };

  console.log('quote.coffee');

}).call(this);

});

require.define("/startup.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var Environment, define, quasiquote, quote, set, startup, unquote, _ref, _ref2;

  Environment = require('./environment').Environment;

  startup = new Environment;

  startup.set('function', require('./function')["function"]);

  require('./conditionals');

  _ref = require('./quote'), quote = _ref.quote, unquote = _ref.unquote, quasiquote = _ref.quasiquote;

  startup.set('quote', quote);

  startup.set('unquote', unquote);

  startup.set('quasiquote', quasiquote);

  startup.set('if', require('./conditionals')["if"]);

  startup.set('macro', require('./macro').macro);

  startup.set('eval', require('./evaluate').eval);

  _ref2 = require('./definition.coffee'), define = _ref2.define, set = _ref2.set;

  startup.set('define', define);

  startup.set('set!', set);

  startup.set('+', function(a, b) {
    return a + b;
  });

  startup.set('-', function(a, b) {
    return a - b;
  });

  startup.set('*', function(a, b) {
    return a * b;
  });

  startup.set('/', function(a, b) {
    return a / b;
  });

  startup.set('%', function(a, b) {
    return a % b;
  });

  startup.set('>', function(a, b) {
    return a > b;
  });

  startup.set('<', function(a, b) {
    return a < b;
  });

  startup.set('>=', function(a, b) {
    return a >= b;
  });

  startup.set('<=', function(a, b) {
    return a <= b;
  });

  startup.set('==', function(a, b) {
    return a === b;
  });

  startup.set('===', function(a, b) {
    return a === b;
  });

  startup.set('true', true);

  startup.set('false', false);

  startup.set('null', null);

  startup.set('undefined', void 0);

  startup.set('max', Math.max);

  startup.set('min', Math.min);

  startup.set('sqrt', Math.sqrt);

  startup.set('floor', Math.floor);

  startup.set('ceiling', Math.ceiling);

  startup.set('round', Math.round);

  module.exports.startupEnvironment = startup;

  console.log('startup.coffee');

}).call(this);

});

require.define("/conditionals.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var Primitive;

  Primitive = require('./primitive').Primitive;

  module.exports = {
    "if": new Primitive(function(stx, env, evaluate) {
      var failure, success, test;
      test = stx[0], success = stx[1], failure = stx[2];
      if (evaluate(test, env)) {
        return evaluate(success, env);
      } else {
        return evaluate(failure, env);
      }
    })
  };

  console.log('conditionals.coffee');

}).call(this);

});

require.define("/tests.coffee", function (require, module, exports, __dirname, __filename) {
    (function() {
  var Environment, Primitive, Reference, Symbol, assert, define, dirtyEnv, e, evaluate, isArray, isBoolean, isFunction, isMacro, isNumber, isPrimitive, isReference, isString, isSymbol, reader, set, test_function, uniq, _function, _ref, _ref2, _test;

  evaluate = require('./evaluate').evaluate;

  _ref = require('./types'), isNumber = _ref.isNumber, isString = _ref.isString, isBoolean = _ref.isBoolean, isFunction = _ref.isFunction, isArray = _ref.isArray, isSymbol = _ref.isSymbol, isMacro = _ref.isMacro, isPrimitive = _ref.isPrimitive, isReference = _ref.isReference;

  Environment = require('./environment').Environment;

  require('./function');

  assert = require('assert');

  assert.ok(isNumber(4));

  assert.ok(isString('poop'));

  e = new Environment.Empty;

  assert.equal(evaluate(4, e), 4, '4 evals to 4');

  assert.equal(evaluate('poop', e), 'poop', '"poop" evals to "poop"');

  assert.equal(evaluate(true, e), true);

  assert.equal(evaluate(null, e), null);

  assert.equal(evaluate(void 0, e), void 0);

  Reference = require('./reference').Reference;

  Primitive = require('./primitive').Primitive;

  uniq = {};

  assert.ok(!isNumber(new Reference(uniq)));

  assert.ok(!isString(new Reference(uniq)));

  assert.ok(!isBoolean(new Reference(uniq)));

  assert.ok(isReference(new Reference(uniq)));

  assert.equal(evaluate(new Reference(uniq), e), uniq);

  assert.equal(evaluate([
    new Reference(function() {
      return uniq;
    })
  ], e), uniq);

  assert.equal(evaluate([
    new Reference(function(a, b) {
      return a + b;
    }), 1, 3
  ], e), 4);

  _test = new Reference(new Primitive(function(stx, env, evaluate) {
    return function() {
      return uniq;
    };
  }));

  assert.ok(evaluate(_test, e) instanceof Primitive);

  _function = new Reference(require('./function')["function"]);

  assert.ok(_function.value instanceof Primitive);

  assert.ok(evaluate(_function, e) instanceof Primitive);

  assert.ok(isFunction(evaluate([_function], e)));

  assert.equal(evaluate([_function, [], 1], e)(), 1);

  assert.equal(evaluate([[_function, [], 1]], e), 1);

  Symbol = require('./symbol').Symbol;

  test_function = evaluate([_function, [new Symbol('a')], new Symbol('a')], e);

  assert.ok(isFunction(test_function));

  assert.equal(test_function(1), 1);

  assert.equal(evaluate([[_function, [new Symbol('a')], new Symbol('a')], 1], e), 1);

  _ref2 = require('./definition'), define = _ref2.define, set = _ref2.set;

  dirtyEnv = new Environment();

  assert.throws((function() {
    return evaluate(new Symbol('foo'), dirtyEnv);
  }), Error);

  evaluate([new Reference(define), new Symbol('foo'), new Reference(uniq)], dirtyEnv);

  assert.equal(evaluate(new Symbol('foo'), dirtyEnv), uniq);

  evaluate([new Reference(set), new Symbol('foo'), 7], dirtyEnv);

  assert.equal(evaluate(new Symbol('foo'), dirtyEnv), 7);

  reader = require('./reader');

  (function() {
    var tree, value;
    tree = reader.readOne("'(1 2 3)");
    value = evaluate(tree);
    assert.ok(isArray(value));
    assert.ok(isNumber(value[0]));
    return assert.equal(1, value[0]);
  })();

  (function() {
    var env, tree, value;
    env = require('./startup').startupEnvironment;
    tree = reader.readOne("(function (a) a)");
    value = evaluate(tree, env);
    assert.ok(isFunction(value));
    assert.equal(3, value(3));
    return assert.notEqual(5, value(3));
  })();

  (function() {
    var env, value;
    env = require('./startup').startupEnvironment;
    value = evaluate(reader.readOne("(function (a) 7 a)"), env);
    assert.ok(isFunction(value));
    assert.equal(3, value(3));
    return assert.notEqual(5, value(3));
  })();

  console.log('tests.coffee');

}).call(this);

});
require("/tests.coffee");

