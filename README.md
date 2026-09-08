# Agent Toolkit

> Production-oriented agent plugins, MCP servers, and reusable skills for
> Claude Code, OpenAI Codex, and GitHub Copilot.

Agent Toolkit is a plugin-first repository for building and distributing
coding-agent capabilities from one source tree. Each plugin owns its source,
host metadata, and documentation. Tests, evaluations, and shared engineering
guidance live at repository level.

## Supported hosts

[![Claude Code](https://img.shields.io/badge/Claude%20Code-native-blueviolet)](docs/harnesses.md)
[![Codex](https://img.shields.io/badge/OpenAI%20Codex-supported-black)](docs/harnesses.md)
[![GitHub Copilot](https://img.shields.io/badge/GitHub%20Copilot-supported-lightgrey)](docs/harnesses.md)
[![.NET 10](https://img.shields.io/badge/.NET-10.0-512BD4)](global.json)

The repository keeps host registrations aligned while preserving each host's
native plugin format:

| Host           | Registry or source                  | Purpose                                |
| -------------- | ----------------------------------- | -------------------------------------- |
| Claude Code    | `.claude-plugin/marketplace.json`   | Marketplace discovery and installation |
| OpenAI Codex   | `.agents/plugins/marketplace.json`  | Plugin discovery and installation      |
| GitHub Copilot | `.github/agents/` and plugin skills | Agent and skill consumption            |

See the [harness guide](docs/harnesses.md) for host-specific behavior and
capability differences.

## Quick start

Clone the repository and select a capability from `plugins/`:

```bash
git clone <repository-url>
cd handy-skills-agents-mcps
```

Install the prerequisites:

- .NET 10 SDK selected by [global.json](global.json)
- Node.js 22.12 or newer for Vally evaluations
- Python for repository validation
- Docker when running an MCP as a container

Build and test the complete .NET solution:

```bash
dotnet build agent-toolkit.slnx
dotnet test --solution agent-toolkit.slnx
```

Validate repository metadata and evaluation definitions:

```bash
python tools/validate_repository.py
vally lint .
```

## What's inside

| Area          | Location                      | Role                                                         |
| ------------- | ----------------------------- | ------------------------------------------------------------ |
| Plugins       | `plugins/`                    | Independent release boundaries for agents, skills, and MCPs  |
| Tests         | `tests/`                      | Unit, integration, and prompt-driven evaluation projects     |
| Documentation | `docs/`                       | Architecture, authoring, packaging, CI, and harness guidance |
| Tools         | `tools/`                      | Repository validation and optional Claude Vally executor     |
| Registries    | `.claude-plugin/`, `.agents/` | Host marketplace metadata                                    |
| Solution      | `agent-toolkit.slnx`          | Shared .NET build and test entry point                       |

Current plugin source includes web research capabilities, a read-only .NET
quality agent, documentation research guidance, and skill-authoring guidance.
Each capability has its own README under `plugins/<id>/`; this file stays
focused on repository-wide usage and conventions.

## How it works

Plugins are isolated and composable. Host metadata points to plugin source, and
the host loads only the installed capability rather than the entire repository.
Executable source remains inside its owning plugin; tests and evaluations remain
under the corresponding root `tests/<plugin>/` directory.

```text
plugins/<plugin-id>/
├── .claude-plugin/plugin.json
├── .codex-plugin/plugin.json
├── agents/                  # executable or host-native agents
├── skills/<name>/SKILL.md   # reusable skills
├── mcps/                    # executable MCP projects
└── README.md                # plugin-specific usage
```

The two marketplace files and plugin manifests are validated together so plugin
IDs, versions, paths, and host registrations do not drift.

## Multi-harness support

Agent Toolkit maintains one canonical `plugins/` tree and publishes its
capabilities through host-appropriate metadata. Host integrations share plugin
source without duplicating implementation:

| Harness            | Consumes                                                | Integration                                           |
| ------------------ | ------------------------------------------------------- | ----------------------------------------------------- |
| **Claude Code**    | `.claude-plugin/marketplace.json` and plugin manifests  | Native marketplace discovery                          |
| **OpenAI Codex**   | `.agents/plugins/marketplace.json` and plugin manifests | Native plugin discovery                               |
| **GitHub Copilot** | Workspace agents, skills, and Copilot SDK applications  | Host instructions or standalone application execution |

The repository does not currently generate adapters for Cursor, OpenCode, or
Antigravity. .NET MCP servers are also not started automatically by plugin
discovery; an MCP client connects to the published Streamable HTTP endpoint,
and standalone .NET agents run as applications.

```text
Canonical source                 Host surface
-----------------                ------------------------------
plugins/<id>/                     Claude marketplace metadata
  .claude-plugin/plugin.json  -> Codex marketplace metadata
  .codex-plugin/plugin.json   -> Copilot agents, skills, or applications
  agents/
  skills/
  mcps/
```

See [docs/harnesses.md](docs/harnesses.md) for host boundaries and supported
integration patterns.

## Quality evaluation

Vally evaluates skills, agents, and MCP tools against checked-in scenarios.
Static linting is fast and deterministic:

```bash
vally lint .
```

Run the Copilot-backed evaluation suite locally:

```bash
vally eval --executor copilot-sdk --suite plugin-evals --require-pass
```

Run the same suite through the local Claude executor after it is built:

```bash
npm ci --prefix tools/vally-executor-claude
npm run build --prefix tools/vally-executor-claude
claude login
vally eval \
  --executor-plugin ./tools/vally-executor-claude \
  --executor claude-cli \
  --suite plugin-evals \
  --require-pass
```

Search-backed evaluations require the provider credentials documented in the
[CI guide](docs/ci.md). Never commit credentials to evaluation files or source.

## CI

GitHub Actions provides two validation workflows:

- [.github/workflows/dotnet-tests.yml](.github/workflows/dotnet-tests.yml):
  builds and runs all .NET unit and integration tests.
- [.github/workflows/evaluation.yml](.github/workflows/evaluation.yml):
  validates metadata, lints Vally definitions, and runs prompt evaluations.

The evaluation workflow runs Copilot first and can run Claude Code sequentially
against the same specifications when `ENABLE_CLAUDE_EVAL=true`. See
[docs/ci.md](docs/ci.md) for required secrets, local equivalents, and workflow
details.

## Contributing

When adding or changing a capability:

1. Keep executable source inside its owning `plugins/<id>/` boundary.
2. Keep unit and integration tests under `tests/<id>/`.
3. Add or update Vally scenarios for behavior exposed through a host surface.
4. Update plugin metadata and documentation with the source change.
5. Run repository validation, Vally lint, focused tests, and `git diff --check`.

## Documentation guide

Detail lives in `docs/`. Recommended reading order:

1. [Plugin catalog](docs/plugins.md): plugin structure and registrations
2. [Architecture](docs/architecture.md): boundaries, runtimes, and ownership
3. [Harnesses](docs/harnesses.md): Claude, Codex, and Copilot integration
4. [Usage](docs/usage.md): local commands and development workflows
5. [Authoring](docs/authoring.md): agent, skill, and plugin conventions
6. [Evaluation](docs/plugin-eval.md): Vally suites and evaluation commands
7. [CI](docs/ci.md): workflows, credentials, and local equivalents
8. [Packaging](docs/packaging.md): local execution and distribution
9. [Round-trip results](docs/round-trip-results.md): real-CLI verification recipes
10. [Tests](tests/README.md): test layout and evaluation coverage
11. [Contributing](CONTRIBUTING.md): contribution workflow and quality checklist

Harness setup, capability boundaries, and host-specific behavior live in
[docs/harnesses.md](docs/harnesses.md). Contribution rules are summarized in
the [Contributing](#contributing) section above, with detailed authoring
guidance in [docs/authoring.md](docs/authoring.md).

For capability-specific setup, see the README inside the relevant directory in
[`plugins/`](plugins/).

## License

This project is distributed under the MIT License.
