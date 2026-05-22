# Technical Blog Studio Outline

Create or refresh the architect-grade outline for an article workspace.

Pass either an existing article folder or a new topic.

Examples:

- `/technical-article-assistant:outline content/blog/2026-05-22-agentic-memory-boundaries`
- `/technical-article-assistant:outline "Event-driven architecture for AI workloads" --category software-architecture`

Runs: `node "${CLAUDE_PLUGIN_ROOT}/scripts/technical-article-assistant.js" outline $ARGUMENTS`
