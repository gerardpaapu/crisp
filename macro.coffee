{Primitive} = require './primitive'
{isFunction} = require './types'
assert = require 'assert'

class Macro
    constructor: (@operator) ->
    expand: (stx, env) ->
        @operator.call null, stx, env

macro = new Primitive (stx, env, evaluate) ->
    assert.equal stx.length, 1, "macro takes exactly one argument"

    operator = evaluate(stx[0], env)

    assert.ok isFunction(operator)

    new Macro operator

module.exports.Macro = Macro
module.exports.macro = macro

console.log('macro.coffee')
