# Technical Article Assistant Plugin

`technical-article-assistant/` is a dedicated plugin package for planning, scaffolding, and reviewing advanced technical articles from a software architect and AI engineer perspective.

It is optimized for long-form technical writing about AI, .NET, software architecture, and DevOps, with emphasis on evidence, trade-offs, operational concerns, and publication readiness.

## Package Surfaces

- Claude Code manifest: `.claude-plugin/plugin.json`
- GitHub Copilot CLI manifest: `plugin.json`
- Commands: `commands/*.md`
- Skills: `skills/*/SKILL.md`
- Agent: `agents/principal-writer.agent.md`
- Templates: `templates/*.md`
- Runtime script: `scripts/technical-article-assistant.js`
- Tests: `tests/technical-article-assistant.test.js`

## What The Plugin Does

- Initializes a structured article workspace in the current project
- Scaffolds article briefs, outlines, drafts, reviews, and source packs
- Encourages architect-grade writing with trade-offs, failure modes, and operational detail
- Supports strategic series planning instead of one-off article drafting only
- Provides skill and agent surfaces for planning, evidence gathering, and editorial review

## Setup

From the repository root:

```powershell
claude plugin marketplace add .
claude plugin install technical-article-assistant@skills-plugins-acps
```

Or install with GitHub Copilot CLI:

```powershell
copilot plugin install .\technical-article-assistant
```

You can also install it from the same local marketplace:

```powershell
copilot plugin marketplace add .
copilot plugin install technical-article-assistant@skills-plugins-acps
```

## Workflow

### 1. Initialize The Workspace

```powershell
node .\scripts\technical-article-assistant.js init
```

Creates:

- `.technical-article-assistant/config.json`
- `content/blog/`
- `content/series/`
- `research/`

Legacy projects using `.technical-blog-studio/config.json` are still recognized.

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

### 3. Refresh Outline And Review Files

```powershell
node .\scripts\technical-article-assistant.js outline content\blog\2026-05-22-designing-reliable-memory-boundaries-for-agent-systems
node .\scripts\technical-article-assistant.js review content\blog\2026-05-22-designing-reliable-memory-boundaries-for-agent-systems
```

### 4. Plan A Series

```powershell
node .\scripts\technical-article-assistant.js series "AI platform architecture"
```

## Available Commands

- `/technical-article-assistant:init`: Initializes the article workspace and writes plugin configuration.
- `/technical-article-assistant:brief`: Creates a full article workspace for a specific topic, category, audience, and article type.
- `/technical-article-assistant:outline`: Creates or refreshes the architect-grade outline for a topic or existing article folder.
- `/technical-article-assistant:review`: Creates or refreshes the editorial and technical review checklist for an article.
- `/technical-article-assistant:series`: Creates a strategic series plan for a content cluster.

## Included Skills

- `architect-blog-writing`: Guides advanced article planning and writing for senior engineers and architects, with strong emphasis on thesis, trade-offs, implementation, and operational consequences.
- `evidence-pack-curation`: Collects authoritative sources, implementation evidence, diagram ideas, and open questions so article claims can be defended.
- `editorial-qa`: Reviews article quality like a principal engineer, prioritizing missing trade-offs, weak framing, operational gaps, and unverifiable claims.

## Included Agent

- `Principal Writer`: A user-invocable agent for advanced technical blog writing across AI systems, .NET platforms, software architecture, and DevOps topics.

This agent is intended for publication-ready writing support and emphasizes substance, architecture decisions, operational implications, and explicit assumptions.

## Templates

- `templates/brief.md`: Brief template for article framing, audience, thesis, and success criteria.
- `templates/outline.md`: Outline template for section structure and argument flow.
- `templates/draft.md`: Draft template for the main article body.
- `templates/review.md`: Review template for technical and editorial quality checks.
- `templates/series.md`: Series-planning template for related article clusters.
- `templates/sources.md`: Source pack template for evidence and supporting material.

## Validation

From the repository root:

```powershell
node --check .\technical-article-assistant\scripts\technical-article-assistant.js
Set-Location .\technical-article-assistant
node --test .\tests\technical-article-assistant.test.js
```
