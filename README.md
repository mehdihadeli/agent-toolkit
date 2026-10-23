# Agent Toolkit

Plugin-first building blocks for coding-agent workflows: .NET MCP servers, .NET agents, Markdown agents, reusable skills, and host commands.

Each capability lives inside its owning plugin. Claude Code, Codex, and Cursor discover plugins through committed marketplace registries; tests and prompt evaluations remain at repository root.

## Quick Start

Install through your native plugin marketplace, or use Python 3.11+ from a clone
for hosts without a repository marketplace route:

```bash
python tools/harness_install.py list
make install-opencode DRY_RUN=1
make install-opencode
make install-copilot PLUGIN=planning
```

The Python installer copies complete skills and supporting assets, not hooks,
agent profiles, or executable services. Make is optional; the Python CLI exposes
the same operations. See [host installation](docs/harnesses.md) for native
marketplace setup, project scope, updates, and safe uninstall.

Preview the documentation website with `npm ci` and `npm run docs:dev`.
See [Documentation Website](docs/website.md) for static builds and GitHub Pages deployment.

Install repository dependencies and run static validation:

```bash
mise install
npm ci
mise run validate
mise run vally-lint
mise run waza-eval
```

Run all .NET tests:

```bash
dotnet test --solution agent-toolkit.slnx
```

Run the complete prompt-evaluation suite with GitHub Copilot:

```bash
mise run vally-eval-copilot-local
```

Claude Code evaluations use the local Claude executor and require Claude authentication and provider configuration:

```bash
npm run build --prefix tools/vally-executor-claude
mise run vally-eval-claude-local
```

See [docs/usage.md](docs/usage.md), [docs/plugin-eval.md](docs/plugin-eval.md), and [docs/ci.md](docs/ci.md) for local and CI workflows.

## What This Repository Provides

| Surface        | Purpose                                                                      | Typical location                                 |
| -------------- | ---------------------------------------------------------------------------- | ------------------------------------------------ |
| .NET MCP       | Portable tools exposed through MCP, including Streamable HTTP or stdio hosts | `plugins/<id>/mcps/<name>/`                      |
| .NET agent     | Standalone executable agent using a typed .NET runtime or SDK                | `plugins/<id>/agents/<name>/`                    |
| Markdown agent | Host-native role, workflow, and safety instructions                          | `plugins/<id>/agents/<name>.md` or host metadata |
| Skill          | Reusable Markdown guidance activated by intent                               | `plugins/<id>/skills/<name>/SKILL.md`            |
| Command        | Short host command that forwards to a repeatable workflow                    | `plugins/<id>/commands/`                         |

These surfaces are managed by plugins. Do not add parallel repository-level agents, skills, commands, or MCP implementations.

## Current Plugins

| Plugin                                             | Surfaces   | Purpose                                                               |
| -------------------------------------------------- | ---------- | --------------------------------------------------------------------- |
| [Search](plugins/search/README.md)                 | .NET MCP   | Bounded public web retrieval and cited research                       |
| [Dotnet Quality](plugins/dotnet-quality/README.md) | .NET agent | Read-only `dotnet format` quality analysis                            |
| [Docs Research](plugins/docs-research/README.md)   | Skill      | Research official documentation and produce implementation checklists |
| [Skill Guide](plugins/skill-guide/README.md)       | Skill      | Design, organize, author, and validate reusable skills                |
| [Planning](plugins/planning/README.md)             | Skill + Node.js | Durable task journals, verified progress, and recovery across sessions |

Plugin registrations are maintained in:

- [Claude marketplace](.claude-plugin/marketplace.json)
- [Codex marketplace](.agents/plugins/marketplace.json)
- [Cursor marketplace](.cursor-plugin/marketplace.json)

Each plugin is an independent release boundary with its own manifests and README. Plugin IDs and versions must remain aligned across all three marketplace registries.

## Multi-Harness Support

One canonical `plugins/` tree serves native marketplaces and local installation.
Each host receives only the surfaces it supports; installing a plugin never
starts a .NET application or MCP server automatically.

| Harness | Registry or installed artifacts | Notes |
| --- | --- | --- |
| **Claude Code** | `.claude-plugin/marketplace.json` + `plugins/*/.claude-plugin/plugin.json` | Native plugin source; optional planning hooks remain Claude-specific. |
| **Codex CLI** | `.agents/plugins/marketplace.json` + `plugins/*/.codex-plugin/plugin.json` | Native marketplace points to canonical plugins and skills. |
| **Cursor** | `.cursor-plugin/marketplace.json` + `plugins/*/.cursor-plugin/plugin.json` | Thin manifests reference canonical skills; no translated source copies. |
| **OpenCode** | `.opencode/{skills,agents,commands}/` (generated, ignored) | Native names and closed `permission` blocks; install under `~/.config/opencode/`. |
| **Antigravity CLI** | `.antigravity/plugins/<id>/{plugin.json,skills,agents}` (generated, ignored) | Self-contained plugins; commands become manual skills; models inherit or use explicit `flash`/`pro` overrides. |
| **GitHub Copilot** | `.copilot/{skills,agents}/` (generated, ignored) | Native `.agent.md` profiles, commands-as-skills; install under `~/.copilot/`. |

```bash
make deps                               # install pinned Python adapter dependency
make generate-all                       # generate all three adapter projections
make validate                           # validate native marketplace metadata
make garden                             # metadata, links, output integrity, source drift
make install-native-opencode DRY_RUN=1   # preview without changing host settings
make install-native-opencode PLUGIN=planning
make doctor-native HARNESS=opencode
make uninstall-native-opencode PLUGIN=planning
make test-harness                       # deterministic adapters and installer tests
```

Claude, Codex, and Cursor use committed registries rather than generated trees.
The generator emits only existing plugin-owned Markdown surfaces; the current
plugins primarily provide skills. It does not turn .NET applications into
Markdown agents or copy the workspace-specific Copilot agent into other hosts.

The dependency-free `make install-opencode`, `make install-copilot`, and other
skills-only targets remain available, including Gemini CLI and Pi. Do not use
both installation routes in the same scope: generated skill IDs are namespaced
and can otherwise duplicate an existing bare-name skill. User scope and copy
mode are defaults. Existing unrelated files and edited installs are refused.

See [Host Harnesses](docs/harnesses.md) for setup, supported surfaces, and limits.

## Supported Hosts And Tools

This repository supports a small set of hosts and development tools. The
plugin source remains shared, but each host consumes only the integration it
supports. The skills-only installer copies canonical skill directories without
generating translated agents or host-specific plugin trees.

| Host or tool          | Integration                                                     | What it supports                                                                     |
| --------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Claude Code           | `.claude-plugin/marketplace.json` and per-plugin `plugin.json`  | Plugin discovery, Markdown skills, Markdown agents, commands, and MCP connections    |
| OpenAI Codex CLI      | `.agents/plugins/marketplace.json` and per-plugin `plugin.json` | Plugin discovery and Markdown skills or other Codex-supported plugin surfaces        |
| GitHub Copilot        | Workspace instructions, Copilot CLI, and Copilot SDK            | Markdown guidance, Copilot-backed evaluations, and the standalone .NET quality agent |
| Cursor                | `.cursor-plugin/marketplace.json` and per-plugin `plugin.json` | Native plugin discovery of canonical skills |
| OpenCode, Antigravity CLI, Gemini CLI, Pi | Python skills installer | Canonical Markdown skills and their scripts, references, and assets |
| MCP clients           | stdio or Streamable HTTP                                        | Connections to the .NET Search MCP and other MCP projects hosted by the user         |
| Vally                 | Repository-local CLI and evaluation specs                       | Static plugin validation, skill activation, agent behavior, and MCP evaluations      |
| Claude Vally executor | `tools/vally-executor-claude`                                   | Runs the same Vally evaluations through Claude Code                                  |
| .NET SDK              | `global.json` and `agent-toolkit.slnx`                          | Build, run, unit-test, and integration-test executable .NET plugins                  |

Host registries discover plugin metadata; they do not automatically start .NET
agents or MCP servers. Run those projects explicitly or configure the host to
launch the MCP transport. See [docs/harnesses.md](docs/harnesses.md) for host
boundaries and [docs/usage.md](docs/usage.md) for local commands.

## How Plugins Work

Each plugin is an isolated, composable release boundary. A plugin can provide
one or more host surfaces: Markdown agents, executable .NET agents, skills,
commands, and .NET MCP projects. Hosts discover only the plugin metadata and
surfaces registered for that host; installing or selecting a plugin does not
turn the entire repository into one agent context.

```text
plugins/search/
├── .claude-plugin/plugin.json       # Claude plugin metadata
├── .codex-plugin/plugin.json        # Codex plugin metadata
├── README.md                        # Plugin usage and validation
├── mcps/search/                     # .NET MCP project
└── shared/tavily/                   # Supporting .NET project

plugins/docs-research/
├── .claude-plugin/plugin.json
├── .codex-plugin/plugin.json
├── README.md
└── skills/docs-research/
  └── SKILL.md                     # Reusable Markdown skill
```

The plugin directory is the source of truth. Marketplace registries point to
these directories, while tests and evaluations remain outside the plugin:

```text
plugin source        plugins/<plugin-id>/
Claude registry      .claude-plugin/marketplace.json
Codex registry       .agents/plugins/marketplace.json
plugin tests         tests/<plugin-id>/
```

Discovery and execution are separate. Claude Code and Codex read marketplace
and plugin metadata. Skills and Markdown agents provide instructions but do not
start .NET processes. .NET agents run as standalone applications, and MCP
projects run as stdio or Streamable HTTP services when a host launches them.

## Architecture

```text
coding host
  -> marketplace registry
    -> plugin manifest
      -> Markdown agent, skill, or command
      -> .NET agent
      -> .NET MCP
        -> external tools or services
```

The repository separates discovery from execution:

- Claude Code and Codex discover plugin metadata from their host-specific registries.
- Skills and Markdown agents provide instructions; they do not start .NET processes automatically.
- .NET agents run as standalone applications.
- MCP projects expose portable capabilities over stdio or Streamable HTTP.
- External providers and API credentials are configured through environment variables.

The canonical plugin source is `plugins/<id>/`. Host metadata belongs in each plugin's `.claude-plugin/` and `.codex-plugin/` directories. Do not duplicate source under generated host trees.

## Plugin Layout

```text
plugins/<plugin-id>/
├── .claude-plugin/plugin.json
├── .codex-plugin/plugin.json
├── README.md
├── agents/                  # Markdown or executable .NET agents
├── commands/                # Host commands, when needed
├── skills/<skill-name>/
│   └── SKILL.md
├── mcps/<mcp-name>/         # Executable MCP projects and metadata
└── Directory.Packages.props # When the plugin owns package versions
```

Use the smallest surface that owns the behavior. Keep executable source and supporting assets inside the plugin. Register distributable plugins in both marketplace files and update plugin documentation when adding or renaming a plugin.

For the detailed structure rules, see [AGENTS.md](AGENTS.md), [docs/architecture.md](docs/architecture.md), and [docs/authoring.md](docs/authoring.md).

## Tests And Evaluations

Tests mirror plugin ownership at repository root:

```text
tests/<plugin-id>/
├── vally/                  # Skill, agent, and MCP prompt evaluations
├── unit-tests/             # Fast isolated .NET tests
└── integration-tests/      # Hosting, process, network, or provider tests
```

Use:

- Vally evaluations for skill activation, agent behavior, tool calls, and prompt contracts.
- xUnit v3 unit tests for deterministic .NET logic.
- xUnit v3 integration tests for hosting, networking, MCP, SDK, or external boundaries.
- Fixtures beside the evaluation or test that consumes them.

Skill-only plugins normally use `tests/<plugin>/vally/` and do not need .NET test projects. Keep credentials out of YAML, fixtures, source, and workflow files.

Run focused checks before broad validation:

```bash
python tools/validate_repository.py
vally lint .
dotnet test --solution agent-toolkit.slnx
```

Prompt evaluations require provider credentials. See [tests/README.md](tests/README.md) and [docs/plugin-eval.md](docs/plugin-eval.md) for executor, BYOK, and Claude configuration.

Waza provides fast, credential-free trigger coverage for every skill and host-native
agent. Run all suites with `mise run waza-eval`, or focus on one surface with
`WAZA_SKILL=skill-guide mise run waza-eval`. Each covered surface requires two
positive trigger tasks and one negative trigger task; repository validation checks
that coverage before CI runs Waza.

## Adding A Plugin

1. Choose the smallest owning surface: MCP, .NET agent, Markdown agent, skill, or command.
2. Create `plugins/<plugin-id>/` with the required manifests, README, and source surface.
3. Add or update both marketplace registries with the same plugin ID and version.
4. Add tests under `tests/<plugin-id>/`, using Vally, xUnit, or both as appropriate.
5. Update relevant documentation and indexes.
6. Run focused validation, then repository validation and the affected tests or evaluation.

Do not commit generated `bin/`, `obj/`, or evaluation result output. Preserve read-only and bounded behavior for tools that access external systems.

## Documentation Map

Detail lives in `docs/`. Read in this order when adding or changing a plugin:

- [AGENTS.md](AGENTS.md): repository map, plugin boundaries, tests, and quality gates
- [docs/plugins.md](docs/plugins.md): plugin catalog and host registrations
- [docs/architecture.md](docs/architecture.md): runtime, ownership, and execution boundaries
- [docs/agents.md](docs/agents.md): Markdown and executable .NET agent conventions
- [docs/agent-skills.md](docs/agent-skills.md): skill structure and progressive disclosure
- [docs/authoring.md](docs/authoring.md): plugin, skill, command, agent, and MCP authoring workflow
- [docs/harnesses.md](docs/harnesses.md): Claude, Codex, Copilot, and MCP host boundaries
- [docs/usage.md](docs/usage.md): local commands and development workflows
- [docs/plugin-eval.md](docs/plugin-eval.md): Vally linting and prompt evaluation
- [docs/ci.md](docs/ci.md): GitHub Actions workflows, credentials, and local equivalents
- [docs/packaging.md](docs/packaging.md): plugin packaging and distribution
- [docs/round-trip-results.md](docs/round-trip-results.md): real-host discovery and verification recipes
- [tests/README.md](tests/README.md): test layout, fixtures, and evaluator setup

For contribution workflow, start with [CONTRIBUTING.md](CONTRIBUTING.md).
Authoring rules are summarized in [docs/authoring.md](docs/authoring.md), and
host-specific capability differences are documented in
[docs/harnesses.md](docs/harnesses.md).

## License

MIT. See [LICENSE](LICENSE).
