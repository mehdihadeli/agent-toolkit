# Agent Toolkit

Plugin-first repository for .NET MCP servers, coding-agent applications, and reusable agent skills for Claude Code, Codex, and GitHub Copilot. Agents, skills, commands, and MCPs are managed as surfaces of their owning plugins.

Read this file as a map. Detailed design guidance lives in `docs/`; plugin-specific usage and validation live in each plugin's `README.md`.

## Map

- [docs/plugins.md](docs/plugins.md): plugin catalog and host registrations.
- [CONTRIBUTING.md](CONTRIBUTING.md): contribution workflow and quality checklist.
- [docs/architecture.md](docs/architecture.md): boundaries, runtimes, and ownership.
- [docs/plugins.md](docs/plugins.md): plugin catalog and host registrations.
- [docs/agent-skills.md](docs/agent-skills.md): skill structure and evaluation.
- [docs/agents.md](docs/agents.md): executable and Markdown agent conventions.
- [docs/authoring.md](docs/authoring.md): plugin, skill, MCP, and test authoring.
- [docs/harnesses.md](docs/harnesses.md): Claude, Codex, Copilot, and MCP host boundaries.
- [docs/plugin-eval.md](docs/plugin-eval.md): Vally linting and prompt evaluation.
- [docs/round-trip-results.md](docs/round-trip-results.md): packaging and discovery validation.
- [docs/usage.md](docs/usage.md): local execution and repository validation.
- [docs/ci.md](docs/ci.md): GitHub Actions workflows, jobs, credentials, and local equivalents.
- [docs/packaging.md](docs/packaging.md): packaging, local execution, and distribution.
- [plugins/](plugins/): canonical plugin source and release boundaries.
- [tests/](tests/): unit, integration, and evaluation projects.
- [.claude-plugin/marketplace.json](.claude-plugin/marketplace.json): Claude marketplace registrations.
- [.agents/plugins/marketplace.json](.agents/plugins/marketplace.json): Codex/agent marketplace registrations.

## Project goals

- Provide portable MCP tools over Streamable HTTP.
- Provide standalone .NET agents for host-specific workflows.
- Package reusable skills separately from executable services.
- Keep plugin source, host metadata, documentation, tests, and evaluations easy to discover.
- Keep tools read-only and bounded where the plugin contract requires it.

## Repository structure

```text
plugins/
	search/          .NET MCP for fetch, crawl, search, llms.txt, and cited research
	dotnet-quality/  standalone GitHub Copilot SDK .NET quality agent
	docs-research/   skill for official documentation research and implementation checklists
	skill-guide/     skill for designing and validating agent skills
.claude-plugin/    Claude marketplace metadata
.agents/plugins/   Codex/agent marketplace metadata
.github/agents/    host-native Markdown agents
.vally.yaml        Vally skill/evaluation discovery and suite configuration
tests/
	<plugin>/
		vally/            Vally evaluation specs and fixtures
		unit-tests/       xUnit v3 unit test project and tests
		integration-tests/ xUnit v3 integration test project and tests
docs/               architecture, plugin, and packaging guidance
```

## Plugin structure

Every plugin follows this release-boundary layout. Host manifests and plugin documentation live at the plugin root; executable code and reusable skills live in their owning directories.

Agents, skills, commands, and MCPs are plugin-managed surfaces. Add or change
them inside `plugins/<plugin-id>/`, update that plugin's README and host
metadata when applicable, and keep tests and evaluations in the corresponding
repository-level `tests/<plugin-id>/` directory.

```text
plugins/<plugin-id>/
├── .claude-plugin/
│   └── plugin.json             Claude plugin manifest
├── .codex-plugin/
│   └── plugin.json             Codex plugin manifest
├── README.md                   plugin usage, setup, and validation
├── agents/                     executable or host-native agent assets, when applicable
├── mcps/                       executable MCP projects, when applicable
│   └── <mcp-id>/
│       ├── *.csproj
│       ├── Program.cs
│       └── ...
├── skills/                     reusable agent skills, when applicable
│   └── <skill-name>/
│       └── SKILL.md            skill frontmatter and instructions
├── .mcp.json                   MCP host configuration, when applicable
└── Directory.Packages.props    package versions, when applicable
```

Current plugin shapes:

```text
plugins/
├── search/
│   ├── mcps/search/             .NET search MCP
│   └── .mcp.json
├── dotnet-quality/
│   └── agents/dotnet-quality-agent/  .NET quality agent
├── docs-research/
│   └── skills/docs-research/    documentation research skill
└── skill-guide/
	└── skills/skill-guide/      skill authoring guidance
```

Keep plugin source inside its plugin directory. Register each distributable plugin in both marketplace files, and keep its Claude and Codex manifests aligned on name and version. Do not add empty placeholder directories or duplicate source under host metadata.

Each `plugins/<id>/` directory is an independent source-of-truth and release boundary. Plugin-local `README.md` files document usage and validation. Root marketplace files register plugins for their host formats. The repository keeps a lightweight root `slnx` only for running the .NET plugin and test projects together.

Do not hand-edit generated output or duplicate plugin source in host metadata. When adding or renaming a distributable plugin, update both marketplace files and its local documentation.

## Plugin boundaries

| Plugin           | Runtime                                 | Host surface           | Scope                                    |
| ---------------- | --------------------------------------- | ---------------------- | ---------------------------------------- |
| `search`         | .NET 10 MCP + Microsoft Agent Framework | Streamable HTTP MCP    | Public web retrieval and cited research  |
| `dotnet-quality` | .NET + GitHub Copilot SDK               | Standalone application | Read-only `dotnet format` analysis       |
| `docs-research`  | Markdown skill                          | Agent skill            | Official documentation research workflow |
| `skill-guide`    | Markdown skill                          | Agent skill            | Skill authoring and validation guidance  |

MCP servers expose executable tools. Standalone agents run as host applications. Skills provide on-demand workflow instructions; they are not MCP servers and do not require .NET projects.

## Choose a plugin surface

Choose the smallest surface that owns the behavior:

| Surface        | Use when                                                                                                                                        | Typical location                      |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `skills/`      | Reusable instructions, workflow guidance, or domain knowledge should activate from user intent.                                                 | `plugins/<id>/skills/<name>/SKILL.md` |
| `commands/`    | A host command is a short, explicit entry point for a repeatable action, usually forwarding to an existing skill or tool.                       | `plugins/<id>/commands/`              |
| Markdown agent | Host-native role needs explicit tools, boundaries, and output rules, without a separate runtime.                                                | `plugins/<id>/agents/<name>.md`       |
| .NET agent     | Work needs executable orchestration, typed code, SDK integration, process control, or a standalone application lifecycle.                       | `plugins/<id>/agents/<name>/`         |
| MCP            | A reusable capability should be exposed as discoverable tools to multiple hosts or clients, especially across a process or deployment boundary. | `plugins/<id>/mcps/<name>/`           |

Do not use a Markdown agent for reusable guidance that belongs in a skill. Do
not create an MCP for instructions alone. Use a .NET agent when the behavior is
an application or runtime, and use an MCP when the primary contract is a set
of callable tools. A plugin may combine surfaces when each has a clear owner;
do not duplicate the same behavior across them.

## Plugin authoring workflow

1. Define one focused purpose and create `plugins/<id>/`.
2. Add only needed surfaces, plus `README.md`, matching Claude and Codex manifests, and host metadata.
3. Keep implementation, configuration, and supporting assets inside the plugin.
4. Register the plugin in both marketplace files and keep name/version aligned.
5. Add the corresponding tests under `tests/<id>/`.
6. Update plugin documentation and relevant repository indexes.
7. Run focused validation, then repository validation before publishing.

## Test structure

Tests mirror plugin ownership but stay at repository root:

```text
tests/<plugin-id>/
├── vally/                  # Prompt behavior for skills, agents, and MCPs
│   └── <area>/eval.yaml
├── unit-tests/             # Fast isolated .NET tests
└── integration-tests/     # Hosting, process, network, or external boundaries
```

Skill-only and Markdown-agent plugins normally use `vally/` evaluations and
fixtures, not .NET test projects. MCPs and .NET agents use focused xUnit v3
unit tests plus integration tests when they cross hosting, process, network,
or external-service boundaries. Add a Vally evaluation when behavior is
observable through a prompt, tool call, skill activation, or agent trajectory.
Keep fixtures beside their evaluation and never put credentials in them.

## Important paths

- `plugins/<id>/.claude-plugin/plugin.json`: Claude plugin manifest.
- `plugins/<id>/.codex-plugin/plugin.json`: Codex plugin manifest when the plugin is distributed through the Codex marketplace.
- `plugins/<id>/mcps/`: executable MCP projects and MCP-specific assets.
- `plugins/<id>/agents/`: executable agents or host-native agent assets owned by a plugin.
- `plugins/<id>/skills/<name>/SKILL.md`: reusable skill and YAML frontmatter.
- `.claude-plugin/marketplace.json`: Claude marketplace registrations.
- `.agents/plugins/marketplace.json`: Codex/agent marketplace registrations.
- `agent-toolkit.slnx`: root .NET solution for plugin and test validation.
- `.github/workflows/evaluation.yml`: GitHub Actions workflow that runs `vally lint`, starts required local runtime dependencies, and executes the root Vally suite.
- `.github/workflows/dotnet-tests.yml`: separate unit/integration workflow for .NET plugins.
- `docs/ci.md`: detailed workflow behavior, credentials, artifacts, and local commands.
- `tests/<plugin>/unit-tests/`: focused xUnit v3 unit tests for that plugin.
- `tests/<plugin>/integration-tests/`: xUnit v3 integration tests for that plugin.

## Development workflow

1. Identify the owning plugin before editing code.
2. Read its README and nearby tests before changing behavior.
3. Keep changes inside the plugin boundary unless a shared marketplace, test, or documentation update is required.
4. Preserve plugin IDs, source paths, versions, and host registrations across metadata files.
5. Use environment variables for credentials and endpoint overrides; never commit secrets.
6. Validate the smallest affected project first, then run broader checks when shared behavior changes.

## Quality gates

Run focused checks from the relevant project directory:

```bash
# Search MCP
cd plugins/search/mcps/search
dotnet build AgentSkillsMcp.Search.csproj
dotnet test --project ../../../../tests/search/unit-tests/AgentSkillsMcp.Search.Tests.csproj
dotnet test --project ../../../../tests/search/integration-tests/AgentSkillsMcp.Search.IntegrationTests.csproj

# Dotnet Quality agent
cd plugins/dotnet-quality
dotnet build agents/dotnet-quality-agent/AgentSkillsMcp.DotnetQuality.CopilotAgent.csproj
dotnet test --project ../../tests/dotnet-quality/unit-tests/AgentSkillsMcp.DotnetQualityAgent.Tests.csproj
dotnet test --project ../../tests/dotnet-quality/integration-tests/AgentSkillsMcp.DotnetQualityAgent.IntegrationTests.csproj

# Claude Vally executor
cd tools/vally-executor-claude
npm install
npm run build
```

From repository root, run the skill and evaluation static gate:

```bash
make check
```

Run all .NET plugin and test projects through the root solution:

```bash
dotnet test --solution agent-toolkit.slnx
```

For skill-only changes, validate YAML frontmatter, referenced paths, Markdown diagnostics, and at least one realistic prompt. For marketplace changes, parse both marketplace JSON files and plugin manifests. Run a relevant evaluation when behavior or skill instructions change.

The GitHub Actions evaluation workflow runs `vally lint`, then executes `vally eval --suite plugin-evals` from root `.vally.yaml`. Vally discovers all nested plugin `eval.yaml` files through the suite definition and launches the C# Search MCP through its named stdio environment. .NET unit and integration projects run separately in `.github/workflows/dotnet-tests.yml`. Configure repository secret `COPILOT_GITHUB_TOKEN` for Copilot-backed evaluations; MCP research evaluations may also require provider secrets.

## Testing strategy

- Test layout follows plugin layout:

```text
tests/
├── docs-research/
│   └── vally/
│       └── eval.yaml
├── skill-guide/
│   └── vally/
│       └── eval.yaml
├── search/
│   ├── vally/
│   │   ├── fetch/eval.yaml
│   │   ├── mcp/eval.yaml
│   │   └── research/eval.yaml
│   ├── unit-tests/
│   │   ├── AgentSkillsMcp.Search.Tests.csproj
│   │   └── FetchToolsTests.cs
│   └── integration-tests/
│       ├── AgentSkillsMcp.Search.IntegrationTests.csproj
│       ├── FetchMcpIntegrationTests.cs
│       └── ResearchAgentIntegrationTests.cs
└── dotnet-quality/
	├── vally/
	│   ├── agent/eval.yaml
	│   └── quality/eval.yaml
	├── unit-tests/
	│   ├── AgentSkillsMcp.DotnetQualityAgent.Tests.csproj
	│   └── TechnicalDebtTests.cs
	└── integration-tests/
		├── AgentSkillsMcp.DotnetQualityAgent.IntegrationTests.csproj
		└── DotnetFormatRunnerIntegrationTests.cs
```

- Every plugin owns its tests under `tests/<plugin>/`. Keep `docs-research` and `skill-guide` Vally-only unless executable test projects become necessary; add `vally/`, `unit-tests/`, and `integration-tests/` only when those test types apply.
- Skills use Vally evaluations, not .NET test projects. Add one `eval.yaml` per plugin evaluation suite under `tests/<plugin>/vally/`; keep supporting fixtures beside that file when needed.
- .NET agents and MCPs use xUnit v3. Keep fast unit tests under `tests/<plugin>/unit-tests/` and tests requiring real hosting, networking, or external boundaries under `tests/<plugin>/integration-tests/`.
- .NET test projects target `net10.0`, enable Microsoft Testing Platform, and use the repository `global.json` setting `test.runner` to `Microsoft.Testing.Platform` so `dotnet test` uses MTP with the .NET 10 SDK.
- Follow [xUnit.net v3 Microsoft Testing Platform guidance](https://xunit.net/docs/getting-started/v3/microsoft-testing-platform#using-net-sdk-version-10-or-later) when creating or changing .NET test projects.
- Run unit and integration tests through `dotnet test`; do not replace executable .NET tests with Vally YAML evaluations.

## Vally evaluation

This repository uses [Vally](https://microsoft.github.io/vally/) to lint skills and organize agent evaluations. `.vally.yaml` is the project-level configuration; keep skill and evaluation paths aligned with the repository structure.

When authoring or running Vally evaluations, use the [Vally reference guide](https://microsoft.github.io/vally/reference) for the current eval schema, executor configuration, BYOK provider settings, CLI commands, and grader options.

Vally requires Node.js 22.12 or newer. Install repository dependencies and run the static gate from repository root:

```bash
npm ci
make check
```

Each Vally evaluation suite is represented by one `eval.yaml` under `tests/<plugin>/vally/`. Specs use Vally's native `stimuli`/`graders` format. Supporting fixtures may live beside the spec; do not add separate test projects or new `plugin`/`kind`/`cases` metadata for skills.

The Claude executor is optional and requires Claude Code authentication:

```bash
make vally-eval-claude
```

For Copilot evaluations, use Vally's `copilot-sdk` executor without the Claude executor plugin.

## Safety and repository hygiene

- Do not commit credentials, API keys, or generated `bin/` and `obj/` output.
- Do not widen HTTP capabilities or remove URL, redirect, timeout, origin, or response-size bounds without tests and documentation.
- Keep search MCP behavior read-only, public-URL bounded, same-origin for crawls, and limited by timeout and response-size controls.
- Keep the .NET quality agent read-only; it reports `dotnet format` diagnostics and never applies fixes.
- Preserve unrelated user changes in the worktree.
- Do not commit or create branches unless explicitly requested.

See [docs/architecture.md](docs/architecture.md), [docs/plugins.md](docs/plugins.md), and [docs/packaging.md](docs/packaging.md) for deeper guidance.
