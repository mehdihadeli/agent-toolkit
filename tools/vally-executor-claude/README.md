# Vally Claude Code Executor

Custom Vally executor for running the repository's eval specs through Claude Code CLI. It complements Vally's built-in `copilot-sdk` executor; Vally runs one executor per invocation.

## Requirements

- Node.js 22.12 or newer
- Vally CLI 0.14.x
- Claude Code CLI installed and authenticated with `claude login`

## Build

```bash
cd tools/vally-executor-claude
npm install
npm run build
cd ../..
```

## Run an evaluation

From repository root:

```bash
vally eval \
  --executor-plugin ./tools/vally-executor-claude \
  --executor claude-cli \
  --eval-spec tests/evaluation/skills/docs-research/eval.yaml \
  --runs 1 --workers 1 --verbose \
  --output-dir .work/vally/results/claude
```

The executor invokes `claude --print --verbose --output-format stream-json`, stages MCP configuration when an eval declares MCP servers, and translates Claude messages, tool calls, tool results, token usage, and timeouts into Vally trajectory events.

For Copilot, run the same eval without this plugin and use `--executor copilot-sdk`.
