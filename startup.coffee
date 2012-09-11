{Environment} = require './environment'

startup = new Environment

require('./function')
require('./conditionals')
require('./quote')

startup.set 'function', require('./function').function

{quote, unquote, quasiquote} = require './quote'

startup.set 'quote', quote
startup.set 'unquote', unquote
startup.set 'quasiquote', quasiquote

startup.set 'if', require('./conditionals').if
startup.set 'macro', require('./macro').macro
startup.set 'eval', require('./evaluate').eval

{define, set} = require './definition.coffee'
startup.set 'define', define
startup.set 'set!', set

startup.set '+', (a, b) -> a + b
startup.set '-', (a, b) -> a - b
startup.set '*', (a, b) -> a * b
startup.set '/', (a, b) -> a / b
startup.set '%', (a, b) -> a % b

startup.set '>', (a, b) -> a > b
startup.set '<', (a, b) -> a < b
startup.set '>=', (a, b) -> a >= b
startup.set '<=', (a, b) -> a <= b
startup.set '==', (a, b) -> a == b
startup.set '===', (a, b) -> a is b

startup.set 'true', true
startup.set 'false', false
startup.set 'null', null
startup.set 'undefined', undefined

startup.set 'max', Math.max
startup.set 'min', Math.min
startup.set 'sqrt', Math.sqrt
startup.set 'floor', Math.floor
startup.set 'ceiling', Math.ceiling
startup.set 'round', Math.round

module.exports.startupEnvironment = startup
