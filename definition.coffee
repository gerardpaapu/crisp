{Primitive} = require './primitive.coffee'
{Symbol} = require './symbol.coffee'

define = new Primitive (stx, env, evaluate) ->
    [place, expr] = stx

    throw new SyntaxError() unless place instanceof Symbol
    throw new Error("#{place.value} already defined") if env.contains(place.value)

    env.set place.value, evaluate(expr, env)

set = new Primitive (stx, env, evaluate) ->
    [place, expr] = stx

    throw new SyntaxError() unless place instanceof Symbol
    throw new Error("#{place.value} not defined") unless env.contains(place.value)

    env.set place.value, evaluate(expr, env)

exports.define = define
exports.set = set
