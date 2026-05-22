# Project Guidelines

## Scope

- This repository is a multi-package workspace for plugins, skills, and ACP-related components.
- Treat each top-level package folder as an independent unit unless the task is explicitly cross-package.
- Current installable packages:
  - `obsidian-vault/`
  - `technical-article-assistant/`

## Structure

- Keep package-local commands, scripts, templates, skills, and tests inside the owning package folder.
- Do not move package-specific files back into the repository root.
- Use the repository root for shared marketplace metadata and cross-package documentation only.

## Working Rules

- `obsidian-vault` entrypoint: `obsidian-vault/scripts/obsidian-vault.js`
- `obsidian-vault` tests: `obsidian-vault/tests/obsidian-vault.test.js`
- `obsidian-vault` docs: `obsidian-vault/README.md`
- `technical-article-assistant` entrypoint: `technical-article-assistant/scripts/technical-article-assistant.js`
- `technical-article-assistant` tests: `technical-article-assistant/tests/technical-article-assistant.test.js`
- `technical-article-assistant` docs: `technical-article-assistant/README.md`
- The template renderer supports both `{{name}}` and spaced `{ { name } }` placeholders because template files may be auto-rewritten.

## Build And Test

From the repository root:

```powershell
node --check .\obsidian-vault\scripts\obsidian-vault.js
Set-Location .\obsidian-vault
node --test .\tests\obsidian-vault.test.js

node --check .\technical-article-assistant\scripts\technical-article-assistant.js
Set-Location .\technical-article-assistant
node --test .\tests\technical-article-assistant.test.js
```

## Installation Notes

- Claude Code marketplace manifest: `.claude-plugin/marketplace.json`
- Claude plugin manifest: `obsidian-vault/.claude-plugin/plugin.json`
- Copilot CLI plugin manifest: `obsidian-vault/plugin.json`
- Claude plugin manifest: `technical-article-assistant/.claude-plugin/plugin.json`
- Copilot CLI plugin manifest: `technical-article-assistant/plugin.json`
- Copilot workspace agent: `.github/agents/obsidian-vault.agent.md`

## Documentation Split

- Use `README.md` for repository overview and install paths.
- Use `AGENTS.md` for shared project instructions across coding agents.
- Use `CLAUDE.md` as the Claude Code entrypoint that imports `AGENTS.md`.
- Use package READMEs for package-specific setup and behavior.
