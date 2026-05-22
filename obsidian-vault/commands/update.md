---
description: Update an existing Obsidian note through frontmatter patch operations or content append operations.
argument-hint: <path-or-title> [--title "..."] [--description "..."] [--add-tags "..."] [--set-tags "..."] [--add-related "..."] [--append "..."] [--show]
---

# Update Note

Update a note by path or title using the Local REST API.

## Usage

```bash
/obsidian-vault:update technologies/dotnet/minimal-apis.md --add-tags "webapi,aspnet"
/obsidian-vault:update "Hexagonal Architecture" --description "Ports and adapters in practice"
/obsidian-vault:update "RAG Patterns" --append "## Evaluation\n\nAdd offline and online evaluation guidance."
/obsidian-vault:update technologies/ai/rag-patterns.md --show
```

Runs: `node "${CLAUDE_PLUGIN_ROOT}/scripts/obsidian-vault.js" update $ARGUMENTS`

## Notes

- Frontmatter fields are updated with `PATCH` and `Target-Type: frontmatter`
- `updated` is refreshed automatically after any change
- Title updates do not rename the file path
