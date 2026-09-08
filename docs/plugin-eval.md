# Plugin Evaluation

This repository uses Vally for static validation and prompt-driven evaluation.

## Static validation

From repository root:

```bash
vally lint .
```

Root `.vally.yaml` discovers evaluation files under `tests/*/vally/` and groups them in the `plugin-evals` suite.

## Focused evaluation

Run one evaluation after selecting its required runtime:

```bash
vally eval --eval-spec tests/docs-research/vally/eval.yaml \
  --executor copilot-sdk --runs 1 --workers 1 --require-pass
```

Run the same spec through Claude Code with the repository executor:

```bash
cd tools/vally-executor-claude
npm install && npm run build
cd ../..
claude login
vally eval --executor-plugin ./tools/vally-executor-claude \
  --executor claude-cli \
  --eval-spec tests/docs-research/vally/eval.yaml \
  --runs 1 --workers 1 --require-pass
```

Use these executor commands for skill, agent, and MCP specs. Vally selects one
executor per invocation; it does not run both hosts from one command. The
agent specs stage custom agents into both host-specific directories.

Search MCP evaluations require the local server and provider credentials:

```bash
dotnet run --project plugins/search/mcps/search/AgentSkillsMcp.Search.csproj
vally eval --eval-spec tests/search/vally/mcp/eval.yaml
```

## Evaluation rules

- Keep fixtures beside the evaluation that uses them.
- Use realistic stimuli that exercise activation and output behavior.
- Do not put secrets in YAML or fixtures; use environment variables.
- Keep Vally evaluations separate from executable xUnit tests.
- Add the relevant evaluation path to CI when introducing a new runtime requirement.

GitHub Actions runs lint and the `plugin-evals` suite in one evaluation job. It runs Copilot first, then optionally runs Claude Code in the same job with separate result directories. Set repository variable `ENABLE_CLAUDE_EVAL=true` and secret `ANTHROPIC_API_KEY` to enable the Claude step; the job installs Claude Code, builds the local executor, and runs the same suite through `claude-cli`.
