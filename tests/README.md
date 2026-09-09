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
make vally-lint
```

Vally's Copilot executor and CLI use pinned root Node dependencies. Run
`npm ci` before local evaluations, then use the Makefile targets so Vally
resolves the repository-local Copilot platform package.

To use a globally installed Vally CLI instead, run `make VALLY=vally
vally-eval`; the Makefile still configures the native Copilot executable.

### Vally BYOK configuration

The Vally `copilot-sdk` executor supports BYOK through its
`executor.config.provider` block. Keep the provider endpoint and model in the
eval spec, and reference only the secret through `apiKeyEnv`:

```yaml
defaults:
  model: deepseek-v4-flash
  executor:
    name: copilot-sdk
    config:
      provider:
        type: openai
        baseUrl: https://api.deepseek.com/v1
        apiKeyEnv: OPENAI_API_KEY
        wireModel: deepseek-v4-flash
```

Set `OPENAI_API_KEY` in the process environment before running Vally. Vally
does not interpolate `OPENAI_BASE_URL` or `OPENAI_MODEL` into these fields;
explicit endpoint and model values keep eval plans validated and reproducible.
See the [Vally BYOK reference](https://microsoft.github.io/vally/reference/eval-spec/#executor-config--byok).

Run one suite with GitHub Copilot:

```bash
make vally-eval
```

Run the same suite with Claude Code after building the local executor:

```bash
cd tools/vally-executor-claude
npm install
npm run build
cd ../..
claude login
make vally-eval-claude
```

The same executor pair applies to every Vally category:

- Skills: `tests/docs-research/vally/eval.yaml` and `tests/skill-guide/vally/eval.yaml`.
- Agent: `tests/dotnet-quality/vally/agent/eval.yaml` and `tests/dotnet-quality/vally/quality/eval.yaml`.
- MCP: `tests/search/vally/mcp/eval.yaml`.

Vally runs one executor per invocation. Run each selected spec once with
`copilot-sdk` and once with `claude-cli`; the agent specs stage the agent in
both `.github/agents/` and `.claude/agents/` so each host can discover it.

MCP eval files declare their server connections through named
`agent_environment` entries. Search evaluations use the C# stdio host, which
Vally launches directly from `.vally.yaml`. Select
`tests/search/vally/mcp/eval.yaml`; MCP evaluations may require
`TAVILY_API_KEY` for the research stimulus. Never commit credentials.

GitHub Actions runs both evaluations in one job through `.github/workflows/evaluation.yml`. It installs GitHub Copilot CLI, lets Vally launch the C# stdio Search MCP from the named environment, and invokes Vally sequentially with `copilot-sdk` and, when enabled, `claude-cli`. Results use separate `copilot/` and `claude/` directories under one artifact. Root `.vally.yaml` discovers all nested plugin `eval.yaml` files. Configure the `COPILOT_GITHUB_TOKEN` repository secret for Copilot-backed evaluation jobs.

Claude evaluation is disabled by default. Enable it with repository variable
`ENABLE_CLAUDE_EVAL=true` and secret `ANTHROPIC_API_KEY`. The same job then
installs Claude Code, builds the local Vally executor, and runs the same suite
after the Copilot evaluation.

.NET unit and integration projects run separately in
`.github/workflows/dotnet-tests.yml` through
`dotnet test --solution agent-toolkit.slnx`.
