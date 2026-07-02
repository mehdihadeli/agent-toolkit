---
description: List notes or subdirectories inside the configured Obsidian workspace root.
argument-hint: [domain-or-path]
---

# List Vault Notes

List files by calling the Local REST API directory endpoints and scoping results to the configured workspace root.

## Usage

```bash
/obsidian-vault:list
/obsidian-vault:list technologies
/obsidian-vault:list technologies/dotnet
```

Runs: `node "${CLAUDE_PLUGIN_ROOT}/scripts/obsidian-vault.js" list $ARGUMENTS`
