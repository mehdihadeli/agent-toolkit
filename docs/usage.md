# Usage

## Discover plugins

Marketplace registrations are in:

- `.claude-plugin/marketplace.json` for Claude Code.
- `.agents/plugins/marketplace.json` for Codex.
- `.cursor-plugin/marketplace.json` for Cursor.

Each entry points to a source directory under `plugins/`.

## Install and use a skill

Install one skill without cloning the repository or installing its plugin:

```bash
gh skill install mehdihadeli/agent-toolkit durable-plans
npx skills add mehdihadeli/agent-toolkit --skill durable-plans
```

Choose one command and select your coding tool when prompted. GitHub CLI 2.90+
is required for `gh skill`; `npx skills` requires Node.js and npm. See
[skills-only installers](harnesses.md#skills-only-installers) for agent selection,
scope, pinning, and the difference from clone-based installation.

After installation, give your coding tool a concrete task:

```text
Use durable-plans to track this migration, record verification evidence, and leave a clear next action for the next session.
```

The host discovers and activates installed skills according to its own rules.
Reading the catalog does not install a skill, and installing a skill does not
start an MCP server, .NET agent, or plugin-level hook.

## Run the search MCP

```bash
dotnet run --project plugins/search/mcps/search/AgentSkillsMcp.Search.csproj
```

Default transport is stdio. Pass `--http`, `--transport=http`, or
`--transport http` to host HTTP at `http://127.0.0.1:6243`. Configure Tavily
enablement and `TAVILY_API_KEY` through the environment. Tavily Search and
Extract are implemented by the shared SDK under
`plugins/search/shared/tavily`.

## Run the quality agent

```bash
dotnet run --project plugins/dotnet-quality/agents/dotnet-quality-agent/AgentSkillsMcp.DotnetQuality.CopilotAgent.csproj
```

Set `QUALITY_AGENT_WORKING_DIRECTORY` to the workspace to inspect. The agent is read-only.

## Validate the repository

```bash
mise run validate
mise run waza-eval
dotnet test --solution agent-toolkit.slnx
vally lint .
```

Run one Waza suite during skill development:

```bash
WAZA_SKILL=skill-guide mise run waza-eval
```

Use Waza for fast mock-based trigger routing, Vally evaluations for real agent
behavior and prompt contracts, unit tests for deterministic logic, and integration
tests for hosted boundaries. See [authoring.md](authoring.md) before adding a
plugin or host surface.
