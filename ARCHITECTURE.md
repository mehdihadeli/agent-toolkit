# Architecture

Top-level architectural map for `agent-toolkit`. Detailed guidance lives in [`docs/`](docs/).

## Invariants

1. **Plugin source is canonical.** Author plugin content and executable source under `plugins/<id>/`. Marketplace files and per-plugin manifests point to that source; they do not duplicate it.
2. **Plugin boundaries are explicit.** Each plugin owns its README, host metadata, skills, agents, commands, MCP metadata, and executable projects. Tests and evaluations live under the repository-level `tests/<id>/` boundary.
3. **Host metadata stays small.** `.claude-plugin/marketplace.json` and `.agents/plugins/marketplace.json` register plugins. Per-plugin `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json` describe host discovery.
4. **Runtime behavior stays bounded.** MCPs remain read-only where documented, use public URL and response limits, validate redirects and origins, and read credentials from environment variables.
5. **Validation matches the surface.** Use Vally for skills and prompt evaluations, xUnit v3 with Microsoft Testing Platform for .NET tests, and build or run checks for executable plugins.

## Component overview

```text
agent-toolkit/
├── AGENTS.md                         # canonical repository context
├── ARCHITECTURE.md                   # this architectural index
├── .claude-plugin/marketplace.json   # Claude plugin registry
├── .agents/plugins/marketplace.json  # Codex plugin registry
├── plugins/                          # canonical plugin source
│   ├── search/                       # .NET Streamable HTTP MCP
│   ├── dotnet-quality/               # GitHub Copilot SDK agent
│   ├── docs-research/                # documentation research skill
│   └── skill-guide/                  # skill authoring skill
├── tests/<plugin>/                   # unit, integration, and Vally evaluation tests
├── docs/                             # detailed project guidance
└── agent-toolkit.slnx            # .NET project and test solution
```

## Plugin model

A plugin uses only the surfaces it provides:

```text
plugins/<id>/
├── .claude-plugin/plugin.json        # Claude metadata
├── .codex-plugin/plugin.json         # Codex metadata
├── agents/                           # executable or Markdown agents
├── commands/                         # host commands, when needed
├── skills/<name>/SKILL.md            # reusable skills
├── mcps/                             # MCP projects and metadata
└── README.md                         # usage and validation
```

The current executable surfaces are:

- `plugins/search/mcps/search`: .NET 10 MCP for fetch, crawl, search, `llms.txt`, and research.
- `plugins/dotnet-quality/agents/dotnet-quality-agent`: read-only .NET quality agent using the GitHub Copilot SDK.

## Runtime boundaries

- Claude Code and Codex discover plugins through their registries and per-plugin manifests.
- MCP clients connect to the Search plugin's Streamable HTTP endpoint.
- The Copilot SDK runs the standalone .NET quality agent.
- Skills are Markdown instructions activated by supported hosts.
- .NET projects are not started automatically by plugin discovery.

## Quality gates

```bash
# Parse and validate Markdown configuration with the repository's Markdown lint rules
# Run from repository root with the chosen markdownlint CLI.

# Static skill and evaluation validation
python tools/validate_repository.py
vally lint .

# All .NET plugin and test projects
dotnet test --solution agent-toolkit.slnx
```

See [authoring.md](docs/authoring.md), [harnesses.md](docs/harnesses.md), [plugin-eval.md](docs/plugin-eval.md), and [round-trip-results.md](docs/round-trip-results.md) for detailed workflows.
