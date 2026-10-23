# Agent Toolkit

Agent Toolkit gives coding agents reusable skills and tools for web research,
documentation lookup, read-only .NET quality analysis, skill authoring, and
planning across sessions.

Each capability lives in a focused plugin, combining Markdown guidance with
scripts, standalone agents, or MCP servers where needed. Install individual
skills or choose a plugin for your coding tool. Shared source keeps the content
consistent across hosts, while each integration respects the host's capabilities.

## Multi-harness support

Choose an installation route for your coding tool. Available components depend
on the route and the host's capabilities.

| Host | Installation route | Available components |
| --- | --- | --- |
| Claude Code | Native plugin marketplace | Canonical plugins and skills; optional Claude-specific planning hooks |
| OpenAI Codex CLI | Native plugin marketplace | Canonical plugins and skills |
| Cursor | Native plugin marketplace | Canonical plugins and skills |
| OpenCode | `make install-native-opencode` | Generated skills, portable agents, and commands with translated tool permissions |
| Antigravity CLI | `make install-native-antigravity` | Generated plugins containing skills and portable agents; commands become manual skills |
| GitHub Copilot | `make install-native-copilot` | Generated agent profiles and skills; commands become manually invoked skills |
| Gemini CLI | `make install-gemini-cli` | Canonical skills and supporting assets |
| Pi | `make install-pi` | Canonical skills and supporting assets |

The dependency-free skills-only installer also supports OpenCode, Antigravity,
and Copilot. Do not mix installation routes in the same scope: generated skill
names can duplicate bare-name skills.

See [Host Harnesses](docs/harnesses.md) for the capability matrix, configuration
paths, model mappings, tool permissions, and installation limits.

## Quick start

Choose a plugin for your task:

| Plugin | Purpose |
| --- | --- |
| [Search](plugins/search/README.md) | Bounded public web retrieval and cited research through a .NET MCP |
| [Dotnet Quality](plugins/dotnet-quality/README.md) | Read-only `dotnet format` analysis through a standalone .NET agent |
| [Docs Research](plugins/docs-research/README.md) | Official documentation research and implementation checklists |
| [Skill Guide](plugins/skill-guide/README.md) | Design, author, and validate reusable skills |
| [Planning](plugins/planning/README.md) | Durable task journals, verified progress, and session recovery |

See the [plugin catalog](docs/plugins.md) for details and the
[usage guide](docs/usage.md) for commands and examples.

### Claude Code

Run inside Claude Code:

```text
/plugin marketplace add mehdihadeli/agent-toolkit
/plugin install agent-toolkit-planning@agent-toolkit
```

Choose another registered plugin for a different workflow. Planning hooks are
optional and Claude-specific; see the [Planning README](plugins/planning/README.md)
before enabling them.

### Codex CLI

Run these commands in a terminal with a current Codex CLI:

```bash
codex plugin marketplace add mehdihadeli/agent-toolkit
codex plugin add agent-toolkit-planning@agent-toolkit
```

The native Codex manifests expose canonical source skills through the committed
`.agents/plugins/marketplace.json`; no generation step is required. This
repository does not generate Codex TOML agents or command-derived skills.
Installing a plugin does not start .NET agents or MCP servers. See
[Codex setup details](docs/harnesses.md#codex-cli) for the native installation
route and its boundaries.

### Cursor

Import `https://github.com/mehdihadeli/agent-toolkit` through Cursor's marketplace
import flow, then install a plugin from Customize. Cursor reads the committed
`.cursor-plugin/marketplace.json` and canonical skills.

See [native marketplace setup](docs/harnesses.md#native-marketplaces) for
host-specific requirements and local testing.

### Skills only

Install an individual skill with GitHub CLI's `gh skill` command or Vercel's
`npx skills` installer. Select your coding tool when prompted. Both fetch
skills from GitHub without requiring a local clone and install them without
the plugin's agents, commands, or hooks.

```bash
gh skill install mehdihadeli/agent-toolkit durable-plans
npx skills add mehdihadeli/agent-toolkit --skill durable-plans
```

`gh skill` requires GitHub CLI 2.90 or later. The `npx` command requires Node.js
and npm. See [skills-only installers](docs/harnesses.md#skills-only-installers)
for available skills, agent selection, install scopes, and version pinning.
For owned installs from a local clone, the
[Python installer](docs/harnesses.md#skills-only-installation) remains available.

### Install from a clone

For OpenCode, Antigravity CLI, and Copilot native artifacts, clone the repository
and install the pinned Python adapter dependency:

```bash
git clone https://github.com/mehdihadeli/agent-toolkit.git
cd agent-toolkit
make deps
```

Choose the target for your host:

```bash
make install-native-opencode PLUGIN=planning DRY_RUN=1
make install-native-opencode PLUGIN=planning
# Alternatives: make install-native-antigravity or make install-native-copilot
```

Make is optional; equivalent Python commands are documented in
[Host Harnesses](docs/harnesses.md). Antigravity filesystem staging may also
require native plugin-manager registration. That guide covers project scope,
updates, installation checks, and safe removal.

## What's inside

| Component | What it provides |
| --- | --- |
| Five plugins | Independent release boundaries with source, manifests, and usage documentation |
| Skills | Markdown guidance, references, and scripts loaded for relevant tasks |
| .NET MCP | Public web tools exposed over stdio or Streamable HTTP |
| .NET agent | Standalone read-only quality analysis using the Copilot SDK |
| Host adapters | Generated native formats for portable Markdown skills, agents, and commands |

Browse [Plugins](docs/plugins.md), [Agents](docs/agents.md), and
[Agent Skills](docs/agent-skills.md) for details.

## How it works

Hosts discover a plugin through its registry and manifests, then consume its
registered surfaces. Installing one plugin does not load the entire repository
into the agent's context.

```text
plugins/docs-research/
+-- .claude-plugin/plugin.json
+-- .codex-plugin/plugin.json
+-- .cursor-plugin/plugin.json
+-- README.md
`-- skills/docs-research/
    `-- SKILL.md                    # Reusable Markdown guidance
```

Native registries reference canonical source. Adapters generate ignored
host-specific artifacts from portable Markdown surfaces. Commands may become
skills, and model choices and tool permissions vary by host. Models inherit
host defaults unless explicitly overridden.

Skills and Markdown agents provide instructions. .NET agents run as standalone
applications; MCP servers expose tools over stdio or Streamable HTTP when
explicitly launched or configured in a host. External providers and credentials
are configured through environment variables.

Adapters do not convert .NET applications into Markdown agents or translate
MCP configuration, secrets, or Claude hooks. MCP clients connect to servers
that users explicitly host or configure.

Source stays inside `plugins/<id>/`; tests and evaluations live under
`tests/<id>/`. See [Architecture](docs/architecture.md) for ownership and runtime
boundaries.

## Quality evaluation

Validation covers different kinds of behavior:

- Repository checks validate manifests, marketplace alignment, links, and evaluation coverage.
- Waza provides credential-free trigger coverage for skills and host-native agents.
- Vally evaluates skill activation, prompt contracts, agent behavior, and MCP tool calls.
- xUnit v3 unit and integration tests exercise executable .NET plugins.
- Deterministic script and installer tests check skill tooling and host adapters.

Install development dependencies and run static checks:

```bash
mise install
npm ci
mise run validate
mise run vally-lint
mise run waza-eval
```

Check generated artifacts and run executable tests:

```bash
make generate-all
make garden
dotnet test --solution agent-toolkit.slnx
make test-harness
```

Run prompt evaluations through GitHub Copilot or the optional Claude executor:

```bash
mise run vally-eval-copilot-local

npm run build --prefix tools/vally-executor-claude
mise run vally-eval-claude-local
```

Prompt evaluations require host authentication and provider configuration.
The Claude executor runs the same Vally suites through Claude Code.
See [Plugin Evaluation](docs/plugin-eval.md), [Tests](tests/README.md), and
[CI](docs/ci.md) for credentials, focused checks, and local equivalents.

## Documentation map

| Guide | Covers |
| --- | --- |
| [Plugin catalog](docs/plugins.md) | Plugins by task and their host registrations |
| [Agents](docs/agents.md) and [skills](docs/agent-skills.md) | Components, conventions, and progressive disclosure |
| [Usage](docs/usage.md) and [host setup](docs/harnesses.md) | Commands, installation routes, and capability limits |
| [Architecture](docs/architecture.md) and [packaging](docs/packaging.md) | Source ownership, runtimes, adapters, and distribution |
| [Evaluation](docs/plugin-eval.md) and [CLI verification](docs/round-trip-results.md) | Prompt checks, real-host recipes, and their limits |
| [Tests](tests/README.md) and [CI](docs/ci.md) | Test layout, credentials, and local workflow equivalents |
| [Documentation website](docs/website.md) | Local preview and GitHub Pages deployment |

Preview the documentation website with `npm ci` and `npm run docs:dev`.

Contributing: [CONTRIBUTING.md](CONTRIBUTING.md). Repository conventions and
quality gates: [AGENTS.md](AGENTS.md). See [authoring conventions](docs/authoring.md)
when adding plugin content.

## License

This project is licensed under the [MIT License](LICENSE).