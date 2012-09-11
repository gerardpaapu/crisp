class Primitive
    constructor: (@operator) ->

    run: (stx, env, evaluate) ->
        @operator.call null, stx, env, evaluate

module.exports.Primitive = Primitive
