Crisp
--

A simple lisp interpreter in coffeescript using runtime macros as inspired by a 
[blogpost from Matt 
Might](http://matt.might.net/articles/metacircular-evaluation-and-first-class-ru
n-time-macros/).

The intention is to bootstrap 
[ChitChat](https://github.com/sharkbrainguy/chitchat) semantics off 
of this, as the complexity of compile time hygenic macros was hurting my brain, 
whereas the model 
used in crisp (while possibly flawed), is very simple to implement and 
understand.
