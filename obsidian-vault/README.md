# Obsidian Vault Plugin

This plugin now lives in the `obsidian-vault/` folder so the repository can host additional plugins and skills over time.

This plugin scaffold manages an Obsidian knowledge vault through [Obsidian Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) instead of editing vault files directly.

The package is now exposed through three compatible surfaces:

- Claude Code via the repository root marketplace manifest
- GitHub Copilot CLI via local-path or marketplace installation
- GitHub Copilot workspace agent configuration under `.github/`

It keeps the same general Claude plugin shape as the reference `obsidian-vault` plugin:

- `.claude-plugin/plugin.json`
- `plugin.json`
- `commands/*.md`
- `skills/vault-management/SKILL.md`
- `templates/*.md`
- `scripts/obsidian-vault.js`

The package keeps both manifest files intentionally:

- `.claude-plugin/plugin.json` for Claude Code plugin discovery
- `plugin.json` at the package root for GitHub Copilot CLI plugin discovery

## What It Does

- Stores plugin configuration in `~/.claude/obsidian-vault.json`
- Talks to Obsidian through HTTP(S) using the Local REST API
- Seeds a software-engineering workspace structure inside the vault
- Creates notes with consistent frontmatter
- Lists, searches, updates, and tags notes without direct filesystem access

## Suggested Vault Structure

The seeded structure is centered on software engineering topics:

```text
software-engineering/
├── README.md
├── technologies/
│   ├── README.md
│   ├── dotnet/README.md
│   ├── ai/README.md
│   ├── docker/README.md
│   └── kubernetes/README.md
├── concepts/
│   ├── README.md
│   ├── software-architecture/README.md
│   ├── distributed-systems/README.md
│   └── testing/README.md
├── patterns/README.md
├── project-notes/README.md
├── references/README.md
├── journal/README.md
└── inbox/README.md
```

## Setup

### Claude Code Installation

From the repository root:

```powershell
claude plugin marketplace add .
claude plugin install obsidian-vault@skills-plugins-acps
```

### GitHub Copilot Compatibility

GitHub Copilot CLI can install this package directly:

```powershell
copilot plugin install .\obsidian-vault
```

or from the repository marketplace:

```powershell
copilot plugin marketplace add .
copilot plugin install obsidian-vault@skills-plugins-acps
```

This repository also provides a workspace-level Copilot agent:

- `.github/agents/obsidian-vault.agent.md`

That file gives Copilot a workspace-native equivalent for this package when you want repo-local behavior in VS Code in addition to the CLI plugin install path.

Repository-wide shared agent guidance now lives in `AGENTS.md`, and `CLAUDE.md` imports it for Claude Code.

1. Install and enable Obsidian Local REST API in Obsidian.
1. Copy the API key from `Settings -> Local REST API & MCP Server`.
1. Set an environment variable before using the commands:

```powershell
$env:OBSIDIAN_REST_API_KEY = "your-api-key"
```

1. Initialize the plugin config and optionally seed the structure:

```powershell
node scripts/obsidian-vault.js init --seed-template
```

If you prefer the insecure HTTP endpoint, use:

```powershell
node scripts/obsidian-vault.js init --protocol http --port 27123 --seed-template
```

## Commands

- `/obsidian-vault:init`
- `/obsidian-vault:add`
- `/obsidian-vault:list`
- `/obsidian-vault:search`
- `/obsidian-vault:update`
- `/obsidian-vault:tags`

## Notes

- The script uses Node's built-in HTTP modules. No extra package is required.
- Frontmatter updates use the API's `PATCH` support for precise field updates.
- Search uses `POST /search/simple/` and filters results to the configured workspace root.
- Tests can be run with `node --test tests/*.test.js` from inside `obsidian-vault/`.
