---
description: Configure the Obsidian vault plugin and seed a software-engineering workspace over the Local REST API.
argument-hint: [--check] [--protocol http|https] [--host 127.0.0.1] [--port 27124] [--workspace-root software-engineering] [--seed-template]
---

# Initialize Obsidian Vault

Set up the plugin config and optionally create the software-engineering workspace structure inside your Obsidian vault through the Local REST API.

## Usage

```bash
/obsidian-vault:init
/obsidian-vault:init --check
/obsidian-vault:init --protocol http --port 27123 --seed-template
/obsidian-vault:init --workspace-root engineering --seed-template
```

Runs: `node "${CLAUDE_PLUGIN_ROOT}/scripts/obsidian-vault.js" init $ARGUMENTS`

## What It Does

- Writes config to `~/.claude/obsidian-vault.json`
- Verifies that the Local REST API is reachable
- Optionally seeds a software engineering note structure for `.NET`, AI, Docker, Kubernetes, software architecture, and related areas

## Requirements

- Obsidian Local REST API must be installed and running
- The API key should be available through `OBSIDIAN_REST_API_KEY` unless you store it in config manually
