{
    isNumber, isString, isBoolean, isFunction, isArray,
    isNull, isUndefined,
    isSymbol, isMacro, isPrimitive, isReference
} = require './types'

{Primitive} = require './primitive'
{Environment} = require './environment'

evaluate = (stx, env) ->
    if isSelfEvaluating stx
        stx

    else if isReference stx
        stx.value

    else if isSymbol stx
        env.lookup stx

    else if isArray stx
        evalArray stx, env

    else
        throw new Error "Can't evaluate #{stx}"

evalArray = (stx, env) ->
    [head, tail...] = stx

    operator = evaluate head, env

    if isMacro operator
        evaluate operator.expand(tail, env), env

    else if isPrimitive operator
        operator.run tail, env, evaluate

    else if isFunction operator
        operands = tail.map (t) -> evaluate t, env
        operator.apply env.context, operands

    else
        throw new Error "Bad operator: #{operator}"

isSelfEvaluating = (stx) ->
    isString(stx) or isNumber(stx) or isBoolean(stx) or isNull(stx) or isUndefined(stx)

module.exports.evaluate = evaluate

module.exports.eval = new Primitive (stx, env, evaluate) ->
    evaluate evaluate(stx, env), env

console.log('evaluate.coffee')
