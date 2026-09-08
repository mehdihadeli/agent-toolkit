# Usage

## Discover plugins

Marketplace registrations are in:

- `.claude-plugin/marketplace.json` for Claude Code.
- `.agents/plugins/marketplace.json` for Codex.

Each entry points to a source directory under `plugins/`.

## Run the search MCP

```bash
dotnet run --project plugins/search/mcps/search/AgentSkillsMcp.Search.csproj
```

The default local endpoint is `http://127.0.0.1:6243`. Configure `TAVILY_API_KEY`, `BING_SEARCH_API_KEY`, and optional endpoint overrides through the environment.

## Run the quality agent

```bash
dotnet run --project plugins/dotnet-quality/agents/dotnet-quality-agent/AgentSkillsMcp.DotnetQuality.CopilotAgent.csproj
```

Set `QUALITY_AGENT_WORKING_DIRECTORY` to the workspace to inspect. The agent is read-only.

## Validate the repository

```bash
dotnet test --solution agent-toolkit.slnx
vally lint .
```

Use unit tests for deterministic logic, integration tests for hosted boundaries, and Vally evaluations for skill activation and prompt behavior. See [authoring.md](authoring.md) before adding a plugin or host surface.
