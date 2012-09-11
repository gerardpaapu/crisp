{evaluate} = require './evaluate'
{Environment} = require './environment'
reader = require './reader'
env = require('./startup').startupEnvironment

class Repl
    constructor: ->
        @env = new Environment(env)

    evaluate: (str) ->
        tree = reader.readOne(str)
        evaluate(tree, @env)


exports.Repl = Repl

console.log('repl.coffee')
