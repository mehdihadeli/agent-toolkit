# Agents

This repository supports two agent forms.

## Executable agents

Executable .NET agents live inside their owning plugin under `agents/`. The current example is the read-only Copilot SDK application:

```text
plugins/dotnet-quality/agents/dotnet-quality-agent/
```

Run it from the plugin directory:

```bash
dotnet run --project agents/dotnet-quality-agent/AgentSkillsMcp.DotnetQuality.CopilotAgent.csproj
```

The application exposes `analyze_dotnet_quality`, runs `dotnet format`, and never modifies the target workspace.

## Markdown agents

Host-native Markdown agents, when needed, belong in a plugin's `agents/` directory. Keep role, scope, tools, safety limits, and expected output explicit. Do not duplicate executable agent implementation in Markdown metadata.

## Ownership

Each agent belongs to one plugin and must be documented by that plugin's README. Add or update the corresponding marketplace entry when adding a distributable plugin.
