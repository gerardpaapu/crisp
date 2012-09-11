{Primitive} = require './primitive'

module.exports =
    if: new Primitive (stx, env, evaluate) ->
        [test, success, failure] = stx
        if evaluate test, env
            evaluate success, env
        else
            evaluate failure, env

console.log('conditionals.coffee')
