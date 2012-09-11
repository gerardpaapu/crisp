COFFEE_FILES = $(wildcard *.coffee)

all: browserify.js

browserify.js: $(COFFEE_FILES)
	browserify \
	    repl.coffee \
	    -o repl.js
