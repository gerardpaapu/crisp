{Primitive} = require './primitive.coffee'

_function = new Primitive (stx, env, evaluate) ->
    [args, body...] = stx

    result = () ->
        env = env.extend associate(args, arguments)
        env.context = this
        env.arguments = arguments

        i = 0
        while i < body.length - 1
            evaluate body[i++], env

        evaluate body[i], env

    return result

associate = (symbols, values) ->
    result = {}

    for symbol, i in symbols
        result[ symbol.value ] = values[i]

    return result

module.exports.function = _function
