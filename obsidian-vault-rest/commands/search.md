---
description: Search the Obsidian vault through the Local REST API and filter results to the configured software-engineering workspace.
argument-hint: <query>
---

# Search Vault

Search notes with Obsidian's built-in search through `POST /search/simple/`.

## Usage

```bash
/obsidian-vault:search kubernetes
/obsidian-vault:search "clean architecture"
/obsidian-vault:search semantic-kernel
```

Runs: `node "${CLAUDE_PLUGIN_ROOT}/scripts/obsidian-vault.js" search $ARGUMENTS`
