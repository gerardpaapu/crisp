class Environment
    constructor: (@parent) ->
       @parent ?= new Environment.Empty
       @table = {}
       @context = null
       @arguments = null

    contains: (key) ->
        @table.hasOwnProperty(key) or @parent.contains(key)

    lookup: (key) ->
        if @table.hasOwnProperty(key)
            @table[key]
        else
            @parent.lookup(key)

    get: (key, fallback) ->
        if @contains key
            @lookup key
        else
            fallback

    set: (key, value) ->
        @table[key] = value

    extend: (values={}) ->
        env = new Environment this

        for key, value of values
            env.set key, value

        return env

    bind: (key, value) ->
        @table[key] = value

class Environment.Empty extends Environment
    constructor: ->
    contains: (key) -> false

    lookup: (key) ->
        throw new Error "#{key} is undeclared"

module.exports.Environment = Environment
