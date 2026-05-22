# Technical Article Assistant Plugin

`technical-article-assistant/` is a second plugin in this repository, focused on advanced technical article production for a `software architect` and `AI engineer` persona.

It is inspired by the workflow ambition of `article-writer`, but it is intentionally different:

- it is optimized for architect-grade long-form technical posts rather than general technical content operations
- it focuses on AI, .NET, software architecture, and DevOps
- it scaffolds evidence-led article workspaces instead of centering on author databases and social media generation
- it emphasizes design trade-offs, operational reality, anti-patterns, and publication review gates

## Install Surfaces

- Claude Code via `technical-article-assistant/.claude-plugin/plugin.json`
- GitHub Copilot CLI via `technical-article-assistant/plugin.json`
- Repository marketplace via `.claude-plugin/marketplace.json`

## What Makes It Unique

- Architect-grade briefs that frame a technical decision, not just a topic
- Advanced outlines that force trade-offs, failure modes, and operational discussion
- Review gates that check technical credibility before publishing
- Series planning for strategic content clusters
- Strong support for AI systems, .NET platforms, software architecture, and DevOps delivery topics

## Workflow

### 1. Initialize

```powershell
node .\scripts\technical-article-assistant.js init
```

Creates:

- `.technical-article-assistant/config.json`
- legacy projects using `.technical-blog-studio/config.json` are still recognized
- `content/blog/`
- `content/series/`
- `research/`

### 2. Create An Article Workspace

```powershell
node .\scripts\technical-article-assistant.js brief "Designing reliable memory boundaries for agent systems" --category ai --audience "staff engineers"
```

This creates a dated article folder with:

- `01-brief.md`
- `02-outline.md`
- `03-draft.md`
- `04-review.md`
- `sources.md`
- `assets/README.md`

### 3. Refresh Supporting Files

```powershell
node .\scripts\technical-article-assistant.js outline content\blog\2026-05-22-designing-reliable-memory-boundaries-for-agent-systems
node .\scripts\technical-article-assistant.js review content\blog\2026-05-22-designing-reliable-memory-boundaries-for-agent-systems
```

### 4. Plan A Content Series

```powershell
node .\scripts\technical-article-assistant.js series "AI platform architecture"
```

## Commands

- `/technical-article-assistant:init`
- `/technical-article-assistant:brief`
- `/technical-article-assistant:outline`
- `/technical-article-assistant:review`
- `/technical-article-assistant:series`

## Included Skills

- `architect-blog-writing`
- `evidence-pack-curation`
- `editorial-qa`

## Validation

From the repository root:

```powershell
node --check .\technical-article-assistant\scripts\technical-article-assistant.js
Set-Location .\technical-article-assistant
node --test .\tests\technical-article-assistant.test.js
```
