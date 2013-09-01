{evaluate} = require './evaluate.coffee'
{Environment} = require './environment.coffee'
reader = require './reader.coffee'
env = require('./startup.coffee').startupEnvironment

class Repl
    constructor: ->
        @env = new Environment(env)

    evaluate: (str) ->
        tree = reader.readOne(str)
        evaluate(tree, @env)


exports.Repl = Repl
