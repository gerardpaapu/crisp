{evaluate} = require './evaluate.coffee'
{
    isNumber, isString, isBoolean, isFunction, isArray,
    isSymbol, isMacro, isPrimitive, isReference
} = require './types.coffee'

{Environment} = require './environment.coffee'
require('./function.coffee')
assert = require 'assert'

assert.ok isNumber 4
assert.ok isString 'poop'

e = new Environment.Empty

assert.equal evaluate(4, e), 4, '4 evals to 4'
assert.equal evaluate('poop', e), 'poop', '"poop" evals to "poop"'
assert.equal evaluate(true, e), true
assert.equal evaluate(null, e), null
assert.equal evaluate(undefined, e), undefined

{Reference} = require './reference.coffee'
{Primitive} = require './primitive.coffee'
uniq = {}


assert.ok !isNumber new Reference(uniq)
assert.ok !isString new Reference(uniq)
assert.ok !isBoolean new Reference(uniq)
assert.ok isReference new Reference(uniq)
assert.equal evaluate(new Reference(uniq), e), uniq
assert.equal evaluate([ new Reference(-> uniq) ], e), uniq
assert.equal evaluate([ new Reference((a, b) -> a + b), 1, 3 ], e), 4

_test = new Reference( new Primitive (stx, env, evaluate) -> (-> uniq) )

assert.ok evaluate(_test, e) instanceof Primitive

_function = new Reference( require('./function.coffee').function )
assert.ok _function.value instanceof Primitive
assert.ok evaluate(_function, e) instanceof Primitive
assert.ok isFunction evaluate([_function], e)
assert.equal evaluate([_function, [], 1], e)(), 1
assert.equal evaluate([[_function, [], 1]], e), 1

{Symbol} = require './symbol.coffee'
test_function = evaluate([_function, [new Symbol('a')], new Symbol('a')], e)
assert.ok isFunction(test_function)
assert.equal test_function(1), 1
assert.equal evaluate([[_function, [new Symbol('a')], new Symbol('a')], 1], e), 1

{define, set} = require './definition.coffee'
dirtyEnv = new Environment()

# foo is undefined Error
assert.throws (-> evaluate(new Symbol('foo'), dirtyEnv)), Error

# define foo as uniq
evaluate [new Reference(define), new Symbol('foo'), new Reference(uniq)], dirtyEnv
assert.equal evaluate(new Symbol('foo'), dirtyEnv), uniq

# update foo to 7
evaluate [new Reference(set), new Symbol('foo'), 7], dirtyEnv
assert.equal evaluate(new Symbol('foo'), dirtyEnv), 7

# reader tests
reader = require './reader.coffee'
do ->
    tree = reader.readOne "'(1 2 3)"
    value = evaluate tree
    assert.ok isArray value
    assert.ok isNumber value[0]
    assert.equal 1, value[0]

do ->
    env = require('./startup.coffee').startupEnvironment
    tree = reader.readOne "(function (a) a)"
    value = evaluate tree, env
    assert.ok isFunction value
    assert.equal 3, value(3)
    assert.notEqual 5, value(3)

do ->
    env = require('./startup.coffee').startupEnvironment
    value = evaluate reader.readOne("(function (a) 7 a)"), env
    assert.ok isFunction value
    assert.equal 3, value(3)
    assert.notEqual 5, value(3)
