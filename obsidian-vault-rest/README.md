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

# Obsidian Vault Plugin

`obsidian-vault/` is a dedicated plugin package for managing an Obsidian knowledge vault through the Obsidian Local REST API instead of direct filesystem edits.

It is designed for software-engineering notes, structured vault organization, and repeatable note operations from Claude Code or GitHub Copilot CLI.

## Package Surfaces

- Claude Code manifest: `.claude-plugin/plugin.json`
- GitHub Copilot CLI manifest: `plugin.json`
- Commands: `commands/*.md`
- Skill: `skills/vault-management/SKILL.md`
- Templates: `templates/*.md`
- Runtime script: `scripts/obsidian-vault.js`
- Tests: `tests/obsidian-vault.test.js`

This package does not ship a package-local agent file. The repository provides a workspace agent under `../.github/agents/obsidian-vault.agent.md` for VS Code usage.

## What The Plugin Does

- Stores plugin configuration in `~/.claude/obsidian-vault.json`
- Connects to Obsidian through HTTP(S) using the Local REST API
- Seeds a software-engineering workspace structure inside the vault
- Creates notes with consistent frontmatter
- Lists, searches, updates, and tags notes without direct vault file edits

## Setup

From the repository root:

```powershell
claude plugin marketplace add .
claude plugin install obsidian-vault@skills-plugins-acps
```

Or install with GitHub Copilot CLI:

```powershell
copilot plugin install .\obsidian-vault
```

You can also install it from the same local marketplace:

```powershell
copilot plugin marketplace add .
copilot plugin install obsidian-vault@skills-plugins-acps
```

Before running commands:

1. Install and enable Obsidian Local REST API in Obsidian.
2. Copy the API key from `Settings -> Local REST API & MCP Server`.
3. Set the API key in your shell session.

```powershell
$env:OBSIDIAN_REST_API_KEY = "your-api-key"
```

4. Initialize the plugin config and optionally seed the default structure.

```powershell
node .\scripts\obsidian-vault.js init --seed-template
```

If you use the HTTP endpoint instead of HTTPS:

```powershell
node .\scripts\obsidian-vault.js init --protocol http --port 27123 --seed-template
```

## Available Commands

- `/obsidian-vault:init`: Configures the plugin, verifies API connectivity, and can seed a software-engineering workspace.
- `/obsidian-vault:add`: Creates a note in a target domain with standard frontmatter, tags, related links, and optional starter content.
- `/obsidian-vault:list`: Lists notes or subdirectories inside the configured workspace root.
- `/obsidian-vault:search`: Runs a vault search through the Local REST API and filters results to the configured workspace.
- `/obsidian-vault:update`: Updates note metadata or appends content without manually editing the note file.
- `/obsidian-vault:tags`: Lists tags and usage counts, optionally filtered by a query.

## Included Skill

- `vault-management`: Guides note creation, search, organization, and updates for a software-engineering vault. It assumes a default workspace rooted at `software-engineering/` and promotes structured frontmatter, related links, and duplicate avoidance.

## Workspace Shape

The seeded structure is centered on software-engineering topics:

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
│   └── distributed-systems/README.md
├── patterns/README.md
├── project-notes/README.md
├── references/README.md
├── journal/README.md
└── inbox/README.md
```

Common note domains include:

- `technologies/dotnet`
- `technologies/ai`
- `technologies/docker`
- `technologies/kubernetes`
- `concepts/software-architecture`
- `concepts/distributed-systems`
- `concepts/testing`
- `patterns`
- `project-notes`
- `references`
- `journal`
- `inbox`

## Templates

- `templates/index.md`: Used for index-style notes when seeding the default workspace structure.
- `templates/note.md`: Used for new notes with the plugin's standard frontmatter fields such as title, description, domain, tags, and related links.

## Agent Surface

- Workspace agent: `../.github/agents/obsidian-vault.agent.md`

Use the workspace agent in VS Code when you want repo-local Copilot behavior without installing the CLI plugin.

## Validation

From the repository root:

```powershell
node --check .\obsidian-vault\scripts\obsidian-vault.js
Set-Location .\obsidian-vault
node --test .\tests\obsidian-vault.test.js
```

## Notes

- The script uses Node's built-in HTTP modules, so no extra runtime dependency is required.
- Frontmatter updates use `PATCH` operations for precise metadata changes.
- Search uses `POST /search/simple/` and scopes results to the configured workspace root.
