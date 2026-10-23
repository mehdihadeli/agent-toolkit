# Plugins

| Plugin         | Runtime                              | Dependency | Host surface          |
| -------------- | ------------------------------------ | ---------- | --------------------- |
| Search         | .NET MCP + Microsoft Agent Framework | None       | MCP                   |
| Dotnet Quality | Copilot SDK .NET agent               | None       | Standalone .NET agent |
| Planning       | Markdown skill + Node.js script      | Node.js 22.12+ | Agent skill       |

[Planning](../plugins/planning/README.md) provides the `durable-plans` skill.
It persists task events and generated checkpoints in the target workspace,
with explicit revision checks, evidence gates, and dependency invalidation.

Each plugin is an independent release boundary under `plugins/<id>/`. Include only
the host surfaces that plugin provides:

Agents, skills, commands, and MCPs are managed through their owning plugin. Do
not add these surfaces as unrelated repository-level assets or duplicate them
under host metadata.

- `.claude-plugin/plugin.json` for Claude metadata.
- `.codex-plugin/plugin.json` for Codex metadata.
- `agents/` for executable or host-native agents.
- `skills/<name>/SKILL.md` for reusable skills.
- `commands/` for host commands when needed.
- `mcps/` for executable MCP projects and MCP metadata.

Executable source stays inside its owning plugin; tests and evaluations stay under
the repository-level `tests/<id>/` directories.

Plugin IDs, versions, and host registrations live in `.claude-plugin/marketplace.json` and `.agents/plugins/marketplace.json`.
