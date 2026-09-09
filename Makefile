SHELL := /bin/bash

VALLY ?= node ./node_modules/@microsoft/vally-cli/dist/index.js
VALLY_EVAL_RUNNER ?= ./tools/run-vally.sh
VALLY_SUITE ?= plugin-evals
VALLY_EVAL_SPEC ?=
# File-backed Vally environments use a process-global session filesystem.
VALLY_WORKERS ?= 1
VALLY_RUNS ?= 1
# Full-suite eval files run in separate Vally processes, avoiding shared session state.
VALLY_PROCESSES ?= 4
export VALLY VALLY_SUITE VALLY_EVAL_SPEC VALLY_WORKERS VALLY_RUNS VALLY_PROCESSES VALLY_ENV_FILE

.PHONY: install validate vally-lint vally-eval vally-eval-copilot vally-eval-copilot-local vally-eval-copilot-ci vally-eval-claude vally-eval-claude-cli vally-eval-claude-local vally-eval-claude-ci check

install:
	npm ci

validate:
	python tools/validate_repository.py

vally-lint:
	$(VALLY) lint .

vally-eval: vally-eval-copilot-local

vally-eval-copilot: vally-eval-copilot-local

vally-eval-copilot-local:
	$(VALLY_EVAL_RUNNER) copilot-sdk local

vally-eval-copilot-ci:
	$(VALLY_EVAL_RUNNER) copilot-sdk ci

vally-eval-claude: vally-eval-claude-local

vally-eval-claude-cli: vally-eval-claude-local

vally-eval-claude-local:
	$(VALLY_EVAL_RUNNER) claude-cli local

vally-eval-claude-ci:
	$(VALLY_EVAL_RUNNER) claude-cli ci

check: validate vally-lint
