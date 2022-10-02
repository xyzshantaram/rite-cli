MAKE_OPTIONS = --unstable
PERMS = --allow-env --allow-read --allow-write --allow-net --allow-run # Deno permissions
ENTRYPOINT = src/main.ts
DENO_NAME ?= rite-cli # install with DENO_NAME=foo to install under a different name

# set DENO_MAKE_EXTRA_OPTIONS in environment to supply extra build options.
OPTIONS = $(MAKE_OPTIONS) $(DENO_MAKE_EXTRA_OPTIONS)

default: compile

dev:
	deno run $(PERMS) $(OPTIONS) --watch $(ENTRYPOINT) $(DENO_RUN_OPTIONS)

bundle:
	deno bundle $(OPTIONS) $(ENTRYPOINT) $(DENO_NAME)

compile:
	deno compile --output $(DENO_NAME) $(PERMS) $(OPTIONS) $(ENTRYPOINT)

install:
	deno install $(PERMS) $(OPTIONS) -n $(DENO_NAME)

run:
	deno run $(PERMS) $(OPTIONS) $(ENTRYPOINT) $(DENO_RUN_OPTIONS)
