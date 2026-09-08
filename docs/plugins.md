# Plugins

| Plugin         | Runtime                              | Dependency | Host surface          |
| -------------- | ------------------------------------ | ---------- | --------------------- |
| Search         | .NET MCP + Microsoft Agent Framework | None       | MCP                   |
| Dotnet Quality | Copilot SDK .NET agent               | None       | Standalone .NET agent |

Each plugin is an independent release boundary under `plugins/<id>/`. Include only
the host surfaces that plugin provides:

- `.claude-plugin/plugin.json` for Claude metadata.
- `.codex-plugin/plugin.json` for Codex metadata.
- `agents/` for executable or host-native agents.
- `skills/<name>/SKILL.md` for reusable skills.
- `commands/` for host commands when needed.
- `mcps/` for executable MCP projects and MCP metadata.

Executable source stays inside its owning plugin; tests and evaluations stay under
the repository-level `tests/<id>/` directories.

Plugin IDs, versions, and host registrations live in `.claude-plugin/marketplace.json` and `.agents/plugins/marketplace.json`.
