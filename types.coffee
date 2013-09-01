{Macro} = require './macro.coffee'
{Symbol} = require './symbol.coffee'
{Primitive} = require './primitive.coffee'
{Reference} = require './reference.coffee'

module.exports =
    isFunction: (obj) ->
        Object::toString.call(obj) is '[object Function]'

    isArray: (obj) ->
        Object::toString.call(obj) is '[object Array]'

    isNumber: (obj) ->
        Object::toString.call(obj) is '[object Number]'

    isBoolean: (obj) ->
        Object::toString.call(obj) is '[object Boolean]'

    isString: (obj) ->
        Object::toString.call(obj) is '[object String]'

    isNull: (obj) -> obj is null

    isUndefined: (obj) -> obj is undefined

    isMacro: (obj) ->
        obj instanceof Macro

    isSymbol: (obj) ->
        obj instanceof Symbol

    isPrimitive: (obj) ->
        obj instanceof Primitive

    isReference: (obj) ->
        obj instanceof Reference
