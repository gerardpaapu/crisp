{Primitive} = require './primitive'

arrayliteral = new Primitive (stx, env, evaluate) ->
    evaluate(item, env) for item in stx

dictionaryliteral = new Primitive (stx, env, evaluate) ->
    throw new SyntaxError() unless stx.length % 2 is 0

    i = 0
    result = {}

    while i < stx.length - 1
        assert stx[i] instanceof Symbol

        result[stx[i++].value] = evaluate(stx[i++], env)

    result
