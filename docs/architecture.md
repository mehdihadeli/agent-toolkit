# Architecture

## Plugin boundary

`plugins/<id>/` is the source-of-truth and release boundary. A plugin may contain Markdown agents, skills, commands, MCP metadata, executable .NET projects, and documentation. Tests and evaluations live at repository root.

```text
coding host -> native plugin metadata -> MCP/agent
                                      -> .NET service
                                      -> external tools
```

## Runtime boundaries

- MCP servers provide portable capabilities over Streamable HTTP.
- Markdown agents provide host-specific role and safety instructions.
- Microsoft Agent Framework provides .NET agent and workflow runtime.
- GitHub Copilot SDK provides a .NET application client for Copilot CLI.

.NET runtimes are not automatically executed by a Claude Code, Codex, or Copilot plugin. MCP projects publish local processes or containers; standalone .NET agents run as host applications.

## Current plugins

Search is a standalone MCP combining web retrieval and cited research in one process, avoiding an MCP-to-MCP network hop. Dotnet Quality is a standalone Copilot SDK .NET application that provides read-only deterministic quality analysis.
