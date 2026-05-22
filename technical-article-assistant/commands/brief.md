# Technical Article Assistant Brief

Create a full article workspace for an advanced technical post.

This scaffolds:

- `01-brief.md`
- `02-outline.md`
- `03-draft.md`
- `04-review.md`
- `sources.md`
- `assets/README.md`

Examples:

- `/technical-article-assistant:brief "Designing multi-agent memory boundaries" --category ai --audience "staff engineers"`
- `/technical-article-assistant:brief "Modern .NET resilience patterns" --category dotnet --article-type deep-dive --keywords dotnet,resilience,architecture`

Runs: `node "${CLAUDE_PLUGIN_ROOT}/scripts/technical-article-assistant.js" brief $ARGUMENTS`
