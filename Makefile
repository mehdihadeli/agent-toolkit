PYTHON ?= python
SCOPE ?= user
MODE ?= copy
HARNESSES := opencode antigravity copilot copilot-vscode gemini-cli pi
NATIVE_HARNESSES := opencode antigravity copilot
NATIVE_INSTALL_TARGETS := $(addprefix install-native-,$(NATIVE_HARNESSES))
NATIVE_UNINSTALL_TARGETS := $(addprefix uninstall-native-,$(NATIVE_HARNESSES))
INSTALL_TARGETS := $(addprefix install-,$(HARNESSES))
UNINSTALL_TARGETS := $(addprefix uninstall-,$(HARNESSES))
OPTIONS = $(if $(PLUGIN),--plugin "$(PLUGIN)",--all) --scope "$(SCOPE)" --mode "$(MODE)" $(if $(TARGET),--target "$(TARGET)") $(if $(filter 1 true yes,$(DRY_RUN)),--dry-run)
NATIVE_OPTIONS = $(if $(PLUGIN),--plugin "$(PLUGIN)") --scope "$(SCOPE)" --mode "$(MODE)" $(if $(TARGET),--target "$(TARGET)") $(if $(filter 1 true yes,$(DRY_RUN)),--dry-run)

.DEFAULT_GOAL := help
.PHONY: help deps list doctor doctor-native generate generate-all validate-generated garden test-harness validate $(INSTALL_TARGETS) $(UNINSTALL_TARGETS) $(NATIVE_INSTALL_TARGETS) $(NATIVE_UNINSTALL_TARGETS)

help:
	@echo "Claude Code, Codex, Cursor: use native plugin marketplaces."
	@echo "make install-<host> [PLUGIN=planning] [DRY_RUN=1] [SCOPE=user|project] [TARGET=directory]"
	@echo "make uninstall-<host> [PLUGIN=planning] [SCOPE=user|project] [TARGET=directory]"
	@echo "make doctor HARNESS=<host> [SCOPE=user|project] [TARGET=directory]"
	@echo "Hosts: $(HARNESSES)"
	@echo "make deps                                      Install Python adapter dependencies"
	@echo "make generate HARNESS=opencode [PLUGIN=planning] Generate native artifacts"
	@echo "make generate-all                              Generate OpenCode, Copilot, Antigravity"
	@echo "make install-native-<host> [DRY_RUN=1]           Install generated skills, agents, and commands"
	@echo "make uninstall-native-<host>                    Remove unchanged owned native artifacts"
	@echo "make doctor-native HARNESS=opencode             Verify native installations"
	@echo "make list | make test-harness | make validate | make garden"

deps:
	$(PYTHON) -m pip install -r tools/requirements.txt

generate:
	$(if $(HARNESS),,$(error HARNESS is required))$(PYTHON) tools/generate.py --harness "$(HARNESS)" $(if $(PLUGIN),--plugin "$(PLUGIN)") $(if $(MODEL),--model "$(MODEL)")

generate-all:
	$(PYTHON) tools/generate.py --harness all

validate-generated:
	$(PYTHON) tools/validate_generated.py --harness "$(if $(HARNESS),$(HARNESS),all)" $(if $(PLUGIN),--plugin "$(PLUGIN)") $(if $(MODEL),--model "$(MODEL)")

garden: validate validate-generated

list:
	$(PYTHON) tools/harness_install.py list

$(INSTALL_TARGETS): install-%:
	$(PYTHON) tools/harness_install.py install --host "$*" $(OPTIONS)

$(UNINSTALL_TARGETS): uninstall-%:
	$(PYTHON) tools/harness_install.py uninstall --host "$*" $(OPTIONS)

$(NATIVE_INSTALL_TARGETS): install-native-%:
	$(PYTHON) tools/install_generated.py install --harness "$*" $(NATIVE_OPTIONS) $(if $(MODEL),--model "$(MODEL)")

$(NATIVE_UNINSTALL_TARGETS): uninstall-native-%:
	$(PYTHON) tools/install_generated.py uninstall --harness "$*" $(NATIVE_OPTIONS)

doctor:
	$(if $(HARNESS),,$(error HARNESS is required))$(PYTHON) tools/harness_install.py doctor --host "$(HARNESS)" $(OPTIONS)

doctor-native:
	$(if $(HARNESS),,$(error HARNESS is required))$(PYTHON) tools/install_generated.py doctor --harness "$(HARNESS)" $(NATIVE_OPTIONS)

test-harness:
	$(PYTHON) -m unittest discover -s tests/harness-install -p "test_*.py" -v

validate:
	$(PYTHON) tools/validate_repository.py