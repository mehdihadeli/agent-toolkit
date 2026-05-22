---
description: List tags and usage counts from the Obsidian vault.
argument-hint: [query]
---

# List Tags

Show tags returned by `GET /tags/`, optionally filtered by a query string.

## Usage

```bash
/obsidian-vault:tags
/obsidian-vault:tags architecture
```

Runs: `node "${CLAUDE_PLUGIN_ROOT}/scripts/obsidian-vault.js" tags $ARGUMENTS`
