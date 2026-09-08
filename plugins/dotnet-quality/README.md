# .NET Quality Agent

Standalone .NET application built with the GitHub Copilot SDK. It analyzes and prioritizes `dotnet format` diagnostics without depending on Claude Code, Codex, or host-provided coding-agent tools.

## Run

Set `QUALITY_AGENT_WORKING_DIRECTORY` to a .NET repository, ensure the `copilot` CLI is available, then run:

```bash
dotnet run --project agents/dotnet-quality-agent/AgentSkillsMcp.DotnetQuality.CopilotAgent.csproj
```

Pass an optional analysis prompt as command-line arguments. The agent exposes a read-only `analyze_dotnet_quality` tool for `all`, `whitespace`, `style`, or `analyzers` scopes. It groups diagnostics by rule and never applies fixes.

```bash
QUALITY_AGENT_WORKING_DIRECTORY=/path/to/repository \
  dotnet run --project agents/dotnet-quality-agent/AgentSkillsMcp.DotnetQuality.CopilotAgent.csproj
```

## Configuration

- `QUALITY_AGENT_WORKING_DIRECTORY`: target .NET repository; defaults to the current directory.
- `COPILOT_MODEL`: optional Copilot model; defaults to `auto`.
