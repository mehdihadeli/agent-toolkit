# Technical Blog Studio Init

Initialize the technical blog workspace in the current project.

Creates:

- `.technical-article-assistant/config.json`
- legacy projects using `.technical-blog-studio/config.json` are still recognized
- `content/blog/`
- `content/series/`
- `research/`

Examples:

- `/technical-article-assistant:init`
- `/technical-article-assistant:init --article-root docs/articles --series-root docs/series`

Runs: `node "${CLAUDE_PLUGIN_ROOT}/scripts/technical-article-assistant.js" init $ARGUMENTS`
