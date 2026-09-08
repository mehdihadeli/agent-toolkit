# Authoring Guide

## Add a plugin

1. Create `plugins/<id>/` with a focused purpose.
2. Add only applicable surfaces: `agents/`, `commands/`, `skills/`, `mcps/`, and `README.md`.
3. Add `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json` when those hosts are supported.
4. Register the plugin in both root marketplace files.
5. Add tests or Vally evaluations under `tests/<id>/`.
6. Update [plugins.md](plugins.md), README links, and the solution when a .NET project is added.

## Add a skill

Create `plugins/<id>/skills/<name>/SKILL.md` with valid frontmatter. Keep activation guidance precise and place supporting material beside the skill instead of inflating its core instructions.

## Add an MCP

Keep implementation inside `plugins/<id>/mcps/`. Bound public URL, redirects, response size, timeouts, origins, and credentials. Put endpoint metadata in the plugin package, never secrets.

## Add tests

Use `tests/<id>/unit-tests/` for fast isolated tests and `tests/<id>/integration-tests/` for hosting, networking, or external boundaries. .NET tests target `net10.0`, use xUnit v3 with `xunit.v3.core.mtp-v2`, Shouldly, and Microsoft Testing Platform.

## Review checklist

- [ ] Plugin purpose and ownership are clear.
- [ ] Host manifests contain matching name and version.
- [ ] No credentials or generated `bin/` and `obj/` files are committed.
- [ ] Tests or evaluations cover new behavior.
- [ ] Focused validation and relevant broader validation pass.
