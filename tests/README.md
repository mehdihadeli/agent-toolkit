# Plugin tests

Each plugin owns its tests under `tests/<plugin>/`:

- `vally/` contains Vally evaluation specs and supporting fixtures.
- `unit-tests/` contains a dedicated xUnit v3 unit-test project and fast tests.
- `integration-tests/` contains a dedicated xUnit v3 integration-test project for hosting, networking, or external boundaries.

Skill-only plugins such as `docs-research` and `skill-guide` use `vally/` without .NET test projects. .NET plugins such as `search` and `dotnet-quality` use xUnit v3 projects under `unit-tests/` and `integration-tests/`.

Run all .NET plugin and test projects together from repository root:

```bash
dotnet test --solution agent-toolkit.slnx
```

Run static validation from repository root:

```bash
vally lint .
```

Run one suite with GitHub Copilot:

```bash
vally eval \
  --eval-spec tests/docs-research/vally/eval.yaml \
  --executor copilot-sdk \
  --runs 1 --workers 1 --require-pass
```

Run the same suite with Claude Code after building the local executor:

```bash
cd tools/vally-executor-claude
npm install
npm run build
cd ../..
claude login
vally eval \
  --executor-plugin ./tools/vally-executor-claude \
  --executor claude-cli \
  --eval-spec tests/docs-research/vally/eval.yaml \
  --runs 1 --workers 1 --require-pass
```

The same executor pair applies to every Vally category:

- Skills: `tests/docs-research/vally/eval.yaml` and `tests/skill-guide/vally/eval.yaml`.
- Agent: `tests/dotnet-quality/vally/agent/eval.yaml` and `tests/dotnet-quality/vally/quality/eval.yaml`.
- MCP: `tests/search/vally/fetch/eval.yaml`, `tests/search/vally/mcp/eval.yaml`, and `tests/search/vally/research/eval.yaml`.

Vally runs one executor per invocation. Run each selected spec once with
`copilot-sdk` and once with `claude-cli`; the agent specs stage the agent in
both `.github/agents/` and `.claude/agents/` so each host can discover it.

Run MCP evaluations only after starting the search server at `http://127.0.0.1:6243`:

```bash
dotnet run --project plugins/search/mcps/search/AgentSkillsMcp.Search.csproj
```

Then select `tests/search/vally/mcp/eval.yaml`. MCP evaluations may require `TAVILY_API_KEY` for the research stimulus. Never commit credentials.

GitHub Actions runs both evaluations in one job through `.github/workflows/evaluation.yml`. It installs GitHub Copilot CLI, starts the local search MCP once, and invokes Vally sequentially with `copilot-sdk` and, when enabled, `claude-cli`. Results use separate `copilot/` and `claude/` directories under one artifact. Root `.vally.yaml` discovers all nested plugin `eval.yaml` files. Configure the `COPILOT_GITHUB_TOKEN` repository secret for Copilot-backed evaluation jobs.

Claude evaluation is disabled by default. Enable it with repository variable
`ENABLE_CLAUDE_EVAL=true` and secret `ANTHROPIC_API_KEY`. The same job then
installs Claude Code, builds the local Vally executor, and runs the same suite
after the Copilot evaluation.

.NET unit and integration projects run separately in
`.github/workflows/dotnet-tests.yml` through
`dotnet test --solution agent-toolkit.slnx`.
