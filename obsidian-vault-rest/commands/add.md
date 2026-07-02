---
description: Create a new Obsidian note in the configured software-engineering workspace via the Local REST API.
argument-hint: <domain> <title> [--description "..."] [--tags "tag1,tag2"] [--related "path1,path2"] [--content "..."]
---

# Add Note To Vault

Create a note using the standard frontmatter template and store it in the configured workspace root.

## Usage

```bash
/obsidian-vault:add technologies/dotnet "Minimal APIs"
/obsidian-vault:add concepts/software-architecture "Hexagonal Architecture" --tags "architecture,ddd"
/obsidian-vault:add technologies/ai "RAG Patterns" --description "Patterns for retrieval-augmented generation"
```

Runs: `node "${CLAUDE_PLUGIN_ROOT}/scripts/obsidian-vault.js" add $ARGUMENTS`

## Domain Examples

- `technologies/dotnet`
- `technologies/ai`
- `technologies/docker`
- `technologies/kubernetes`
- `concepts/software-architecture`
- `concepts/distributed-systems`
- `patterns`
- `project-notes`
- `references`
- `journal`
- `inbox`
