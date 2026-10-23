# Host Harnesses

Canonical source stays under `plugins/`. Claude Code, Codex, and Cursor use
committed marketplace metadata. Python adapters project portable Markdown
surfaces into ignored native trees for OpenCode, Copilot, and Antigravity.

## Native Marketplaces

| Host | Registry | Per-plugin metadata |
| --- | --- | --- |
| Claude Code | `.claude-plugin/marketplace.json` | `plugins/<id>/.claude-plugin/plugin.json` |
| Codex CLI | `.agents/plugins/marketplace.json` | `plugins/<id>/.codex-plugin/plugin.json` |
| Cursor | `.cursor-plugin/marketplace.json` | `plugins/<id>/.cursor-plugin/plugin.json` |

### Claude Code

Run inside Claude Code:

```text
/plugin marketplace add mehdihadeli/agent-toolkit
/plugin install agent-toolkit-planning@agent-toolkit
```

Replace the plugin name with any registered plugin. Planning's optional hooks
remain opt-in and Claude-specific; read its README before enabling them.

### Codex CLI

Add this repository in Codex's plugin manager and select a registered plugin.
The committed `.agents/plugins/marketplace.json` resolves each source relative
to its registry directory. Per-plugin Codex metadata references canonical
skills. No generated Codex skill or agent tree is required by this route.

### Cursor

Import `https://github.com/mehdihadeli/agent-toolkit` as a marketplace through
Cursor's supported repository import flow, then install the desired plugin
from Customize. Team marketplace import may require a Teams/Enterprise plan
and admin permission. For local testing, copy a complete plugin directory
under `~/.cursor/plugins/local/` and reload Cursor; current Cursor rejects
local-plugin symlinks whose targets lie outside that directory.

Each manifest lives inside its owning plugin and references its canonical
skills. Empty agent/hook fields suppress unsupported surfaces. Repository
contributor guidance lives in `.cursor/rules/`; it is not installed into a
consumer project automatically. See the [Cursor plugin documentation](https://cursor.com/docs/plugins).

## Native Artifact Adapters

Use Python 3.11+ and the pinned PyYAML dependency. Make is optional:

```bash
python -m pip install -r tools/requirements.txt
python tools/generate.py --harness all
python tools/validate_generated.py --harness all
python tools/install_generated.py install --harness opencode --plugin planning --dry-run
python tools/install_generated.py install --harness opencode --plugin planning
python tools/install_generated.py doctor --harness opencode
python tools/install_generated.py uninstall --harness opencode --plugin planning
```

Equivalent Make targets:

```bash
make deps
make generate-all
make generate HARNESS=opencode PLUGIN=planning
make garden
make install-native-opencode PLUGIN=planning DRY_RUN=1
make install-native-copilot PLUGIN=planning
make doctor-native HARNESS=copilot
make uninstall-native-copilot PLUGIN=planning
make test-harness
```

`make validate` checks marketplace metadata and Markdown links. `make garden`
also checks generated output against canonical sources; generate first on a
fresh clone. `make validate-generated HARNESS=opencode` checks one projection
without writing. Generation of one plugin preserves neighboring owned output.
The optional `--output` argument selects a separate generation root.

### Layout

```text
plugins/<id>/
	.claude-plugin/plugin.json
	.codex-plugin/plugin.json
	.cursor-plugin/plugin.json
	skills/<name>/SKILL.md
	agents/<name>.md              # only when a portable Markdown agent exists
	commands/<name>.md            # only when a portable command exists
tools/
	adapters/{base,opencode,copilot,antigravity}.py
	generate.py
	validate_generated.py
	install_generated.py
	harness_install.py
	requirements.txt
```

| Harness | Generated projection | User installation root |
| --- | --- | --- |
| OpenCode | `.opencode/{skills,agents,commands}/` | `~/.config/opencode/` |
| Copilot | `.copilot/{skills,agents}/` | `~/.copilot/` |
| Antigravity | `.antigravity/plugins/<id>/{plugin.json,skills,agents}` | `~/.gemini/antigravity-cli/` |

OpenCode and Copilot component names are prefixed with their plugin ID.
Antigravity preserves bare component names inside self-contained plugins.
Support files, binary assets, and executable modes are preserved with skills.
Commands remain native Markdown in OpenCode and become manually invoked
skills in Copilot and Antigravity. Argument placeholders in those converted
skills become prose; they do not retain slash-command argument interpolation.

For Antigravity's native plugin manager registration, prefer:

```bash
agy plugin install ./.antigravity/plugins/agent-toolkit-planning
agy plugin list --json
```

`make install-native-antigravity` stages owned plugin files into the documented
global plugin directory without editing host settings. Filesystem staging is
not a substitute for manager registration on CLI versions that require it.
See [Antigravity plugins](https://antigravity.google/docs/plugins?tab=cli).

### Conversion Boundaries

Agents require `description` and may have `name`, `tools`, and `model`.
OpenCode uses `mode: subagent` and a deny-by-default permission block when
an allowlist exists; an explicit empty list stays locked. Copilot uses native
tool aliases and `.agent.md`. Antigravity emits `subagent: true`.
Unknown tools and unsupported agent/command frontmatter fail generation.
Host tool aliases can group several source operations; review generated policy
before using a security-sensitive agent. Body text is not automatically ported.

Models inherit the host default unless the source explicitly requests one.
Non-inherited source models require `--model <host-native-id>` for one harness
(or `MODEL=...` with Make); Antigravity accepts `inherit`, `flash`, or `pro`.
The generator does not silently substitute a paid model tier.

Portable agents and commands must be standalone Markdown. Relative Markdown
asset links and `${CLAUDE_PLUGIN_ROOT}` require manual porting into a skill.
Full YAML frontmatter is parsed with PyYAML, not a custom line parser.

Current plugins primarily supply skills. The .NET quality application is not
a Markdown agent; the workspace Copilot agent depends on specific tools and
is not projected. .NET projects, MCP configuration, secrets, host settings,
Claude hooks, and workflow rules are not translated or started automatically.

### Safe Updates And Removal

User scope and `copy` mode are defaults. OpenCode and Copilot accept project
scope under `.opencode/` and `.github/`, respectively. `--target` (Make `TARGET`) replaces the project/home root, not the final
configuration directory. Antigravity plugin staging is user-scoped.
Without an explicit target, user installs honor `XDG_CONFIG_HOME` for OpenCode,
`COPILOT_CONFIG_DIR`, and `ANTIGRAVITY_CONFIG_DIR`.

`--mode link` is opt-in and may need Windows symlink privileges. Keep the clone
and generated output at the same path. Linked edits change generated files;
generation refuses edited output. Copy mode needs no symlink privileges.

`.agent-toolkit-generated.json` records generated file hashes and provenance.
`.agent-toolkit-native-installs.json` records installed artifacts. Keep these
records: updates/removal require unchanged owned content. Unmanaged files,
foreign checkout records, linked parents, and modified copies are refused.
No force-overwrite option exists. Uninstall still works after source removal.
Removing a source component does not silently uninstall its old copy; use the
owned uninstall command before regenerating/reinstalling a reduced plugin.

Dry runs use temporary generation and do not change host roots or repository
projections. Generation and installation have per-root locks. Replacement is
staged and rolls back on ledger failure for each artifact; a multi-artifact
install is not one atomic transaction. Verify no process is active before
manually clearing a stale lock after an interrupted process.

`doctor` verifies local ownership/integrity, not live host activation. CI tests
fixtures, real skill assets, and filesystem behavior on Windows/Linux. It does
not claim authenticated end-to-end execution inside every host.

## Skills-Only Installation

For bare-name canonical skills without adapter generation or dependencies:

```bash
python tools/harness_install.py list
python tools/harness_install.py install --host copilot --plugin planning --dry-run
python tools/harness_install.py install --host opencode,antigravity --all
python tools/harness_install.py doctor --host copilot
python tools/harness_install.py uninstall --host copilot --plugin planning
```

`make install-opencode`, `make install-copilot`, and corresponding uninstall
targets retain this route. Native marketplace hosts are rejected by this
Python installer. Gemini CLI, Pi, and `copilot-vscode` also support this route.
The ledger is `.agent-toolkit-installs.json` inside the skills directory.

| Host | Project skills | User skills |
| --- | --- | --- |
| OpenCode | `.agents/skills/` | `~/.config/opencode/skills/` |
| Antigravity | `.agents/skills/` | `~/.gemini/antigravity-cli/skills/` |
| Copilot CLI | `.agents/skills/` | `~/.copilot/skills/` |
| Copilot VS Code | `.github/skills/` | `~/.copilot/skills/` |
| Gemini CLI | `.agents/skills/` | `~/.gemini/skills/` |
| Pi | `.agents/skills/` | `~/.agents/skills/` |

The older Node CLI remains available through `tools/harness-install.mjs`, npm
`harness`, and the existing mise install tasks. Its defaults differ: project
scope, `copilot-cli` selector, and optional direct skill installs for native
marketplace hosts. Prefer native marketplaces for those hosts and the Python
routes above for new automation. `mise run harness-test` runs both test sets.

Do not combine bare-name and generated skill installation in overlapping
scopes: the namespaced projection can duplicate an already installed skill.
Several tools share `.agents/skills/`; removing a skill there affects all its
consumers. Restart/reload tools if their discovery is cached.
