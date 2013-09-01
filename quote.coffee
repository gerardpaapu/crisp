{Macro} = require './macro.coffee'
{Reference} = require './reference.coffee'
{isArray} = require './types.coffee'
{Primitive} = require './primitive.coffee'

quote = new Primitive (body, env, evaluate) ->
    throw new SyntaxError unless body.length is 1
    body[0]

quasiquote = new Macro (body, env) ->
    for stx in body
        if isUnquoted stx, env
            stx[1..]
        else
            [ new Reference(quote), stx ]

unquote = new Macro (body, env) ->
    throw new Error "Unquote should only be inside a quasiquote"

isUnquoted = (stx, env) ->
    isArray(stx) and stx.length > 0 and (
        env.get(stx[0], null) is unquote or
        stx[0] instanceof Reference and stx[0].value is unquote)

module.exports =
    quote: quote
    quasiquote: quasiquote
    unquote: unquote
