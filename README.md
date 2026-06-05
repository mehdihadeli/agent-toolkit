# skills-plugins-acps

This repository is a container for plugins, skills, and ACP-related packages.

The goal is to keep each plugin or skill in its own folder so the repository can grow without mixing command files, templates, scripts, and metadata from different packages at the root.

## Layout

```text
skills-plugins-acps/
├── technical-article-assistant/
├── obsidian-vault/
└── .idea/
```

## Current Packages

### obsidian-vault

The [obsidian-vault](obsidian-vault/README.md) package is a plugin for managing an Obsidian vault through Obsidian Local REST API.

The same package is installable in both Claude Code and GitHub Copilot CLI.

Its package layout is:

```text
obsidian-vault/
├── .claude-plugin/
├── commands/
├── scripts/
├── skills/
├── templates/
├── tests/
└── README.md
```

### technical-article-assistant

The [technical-article-assistant](technical-article-assistant/README.md) package is a dual Claude Code and Copilot CLI plugin for planning and scaffolding advanced technical articles in AI, .NET, software architecture, and DevOps.

It is designed for long-form articles written from the perspective of a software architect and AI engineer.

## Development Approach

- Keep each plugin or skill in its own top-level folder.
- Avoid placing package-specific commands, scripts, or templates in the repo root.
- Prefer self-contained package READMEs for package-specific setup and usage.
- Use the repo root README for cross-package structure and navigation.

## Agent Instruction Files

This repository now uses:

- `AGENTS.md` as the shared instruction file for Copilot and other agent tooling that understands `AGENTS.md`
- `CLAUDE.md` as the Claude Code entrypoint, importing `AGENTS.md` so the guidance is not duplicated

Do we need both?

- Yes, if you want first-class support for both ecosystems.
- No, if you only care about one tool.

In practice, the low-maintenance setup is to keep shared guidance in `AGENTS.md` and let `CLAUDE.md` import it.

## Testing

Current local validation for the Obsidian plugin:

```powershell
Set-Location .\obsidian-vault
node --check .\scripts\obsidian-vault.js
node --test .\tests\obsidian-vault.test.js
```

Current local validation for the technical blog plugin:

```powershell
Set-Location .\technical-article-assistant
node --check .\scripts\technical-article-assistant.js
node --test .\tests\technical-article-assistant.test.js
```

## Installation

### Claude Code

This repository is now a local Claude Code marketplace because it includes `.claude-plugin/marketplace.json` at the root.

```powershell
claude plugin marketplace add .
claude plugin install obsidian-vault@skills-plugins-acps
claude plugin install technical-article-assistant@skills-plugins-acps
```

### GitHub Copilot

GitHub Copilot CLI can install this package directly from the plugin folder or from the same repository marketplace:

```powershell
copilot plugin install .\obsidian-vault
```

or:

```powershell
copilot plugin marketplace add .
copilot plugin install obsidian-vault@skills-plugins-acps
copilot plugin install technical-article-assistant@skills-plugins-acps
```

This repository also includes a workspace agent under `.github/`:

- `.github/agents/obsidian-vault.agent.md`

Open the workspace in VS Code with GitHub Copilot enabled and select the `Obsidian Vault` agent when you want repo-local Copilot behavior without relying on an installed CLI plugin.

## Global Configs

The [global-configs/setup-globals.js](global-configs/setup-globals.js) script deploys shared user-level configuration into Claude Code, Copilot CLI, Repomix, and VS Code, then installs the curated third-party skills with `npx skills add`.

Run it from the repository root:

```bash
node ./global-configs/setup-globals.js
```

Useful modes:

```bash
node ./global-configs/setup-globals.js --skills-only
node ./global-configs/setup-globals.js --skip-skills
```

The setup script currently installs these curated third-party skills with `npx skills add`:

- `https://github.com/blader/humanizer`
- `eraserlabs/eraser-io`

By default it targets `claude-code` and `github-copilot` in global scope:

```bash
node ./global-configs/setup-globals.js --skills-only
```

The global-configs test coverage lives in [global-configs/tests/setup-globals.test.js](global-configs/tests/setup-globals.test.js). It covers:

- Claude Code and Copilot CLI install target directories
- VS Code Copilot user configuration directory
- `--skills-only` and `--skip-skills` argument parsing
- Curated `npx skills add` command composition
- `npx skills list -g --json` parsing and per-agent skill checks

Run the deterministic test suite with:

```bash
command node --test ./global-configs/tests/setup-globals.test.js
```

There is also an opt-in live assertion that checks the installed curated skills returned by `npx skills list -g --json` for both `Claude Code` and `GitHub Copilot`:

```bash
RUN_LIVE_SKILLS_ASSERTIONS=1 command node --test ./global-configs/tests/setup-globals.test.js
```

Notes:

- A Claude skill like Humanizer is not a Copilot CLI plugin or a VS Code MCP server by itself.
- The open `skills` CLI from `vercel-labs/skills` can install shared `SKILL.md`-based skills into both `~/.claude/skills` and `~/.copilot/skills`.
- Eraser supports both skills and MCP. Prefer the MCP server when you want richer tool integration and your agent supports MCP.
- Copilot CLI packages still need a proper plugin package such as [obsidian-vault](obsidian-vault) or [technical-article-assistant](technical-article-assistant).
- VS Code Copilot integrations belong in [global-configs/vscode-copilot/mcp.json](global-configs/vscode-copilot/mcp.json) for MCP servers or [global-configs/vscode-copilot/settings.json](global-configs/vscode-copilot/settings.json) for chat/plugin settings.

## Adding Another Plugin Or Skill

Create a new top-level folder for each new package, for example:

```text
skills-plugins-acps/
├── technical-article-assistant/
├── obsidian-vault/
├── another-plugin/
└── some-skill/
```

Each package should carry its own scripts, metadata, docs, and tests.
