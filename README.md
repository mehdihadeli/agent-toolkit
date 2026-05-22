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

The [obsidian-vault](f:/skills-plugins-acps/obsidian-vault) package is a plugin for managing an Obsidian vault through Obsidian Local REST API.

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

The [technical-article-assistant](f:/skills-plugins-acps/technical-article-assistant) package is a dual Claude Code and Copilot CLI plugin for planning and scaffolding advanced technical articles in AI, .NET, software architecture, and DevOps.

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
