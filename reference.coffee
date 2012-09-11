# Reference wraps a value and always evaluates to that value
# --
#
# This can be used in macros to preserve values in the output e.g.
#
# (define cond (macro (lambda (body)
#                        (list (reference if) ; refers
#                              (first body)
#                              (second body)
#                              (cons (reference cond)
#                                    (slice body 2))))))

class Reference
    constructor: (@value) ->

module.exports.Reference = Reference
