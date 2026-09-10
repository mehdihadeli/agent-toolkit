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

## Vally BYOK configuration

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

This differs from the custom `claude-cli` executor. Claude Code reads
`ANTHROPIC_MODEL`, `ANTHROPIC_BASE_URL`, and its credential from the inherited
process environment, so a Claude eval can select the runner without embedding
provider settings:

```yaml
defaults:
  executor: claude-cli
```

To verify provider settings explicitly, use a literal model and endpoint and
keep only the credential environment-based:

```yaml
defaults:
  model: deepseek-v4-flash
  executor:
    name: claude-cli
    config:
      provider:
        baseUrl: https://api.deepseek.com/anthropic
        apiKeyEnv: ANTHROPIC_API_KEY
```

The Claude executor accepts `apiKeyEnv` as an environment-variable name, but
does not interpolate `baseUrl: ANTHROPIC_BASE_URL`. Omitting `model` and
`baseUrl` instead lets Claude Code use inherited `ANTHROPIC_MODEL` and
`ANTHROPIC_BASE_URL` values loaded by the Make wrapper.

Copilot BYOK cannot use `OPENAI_MODEL` or `OPENAI_BASE_URL` as placeholder
values in the eval. Keep the model and absolute base URL literal, and use
`apiKeyEnv` only for the credential. The Claude form is supported by the
repository's custom executor; it is not a general Vally interpolation feature.

### Run one eval with both executors

An eval can keep Copilot as its default executor and still run with Claude.
For example, this configuration makes `copilot-sdk` the default:

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
```

Run that file with Copilot without an override:

```bash
make vally-eval-copilot-local \
  VALLY_EVAL_SPEC=tests/dotnet-quality/vally/quality/eval.yaml
```

Run the same file with Claude by passing the Claude executor through the
command:

```bash
make vally-eval-claude-local \
  VALLY_EVAL_SPEC=tests/dotnet-quality/vally/quality/eval.yaml
```

The Claude target passes `--executor claude-cli` to Vally. That command-line
executor overrides `defaults.executor`, so the YAML does not need to change.
Claude uses its own inherited `ANTHROPIC_*` configuration loaded by the Make
wrapper. This supports running one shared eval spec with both executors.

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
npm ci
npm run build --prefix tools/vally-executor-claude
claude login
make vally-eval-claude
```

Claude evaluations support two executor-selection approaches:

1. Pass the executor through the Vally command. `make vally-eval-claude-local`
   invokes Vally with `--executor claude-cli`; this overrides the executor in
   the eval spec.
2. Select the executor in the eval spec. Set
   `defaults.executor: claude-cli`, then run
   `make vally-eval-claude-default-local`. This target omits `--executor` from
   the Vally command, so Vally uses the eval's default executor.

The second target requires `VALLY_EVAL_SPEC`, for example:

```bash
make vally-eval-claude-default-local \
  VALLY_EVAL_SPEC=tests/dotnet-quality/vally/quality/eval.yaml
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
the `ANTHROPIC_API_KEY` secret and `ANTHROPIC_BASE_URL` and
`ANTHROPIC_MODEL` repository variables. The same job then
installs Claude Code, builds the local Vally executor, and runs the same suite
after the Copilot evaluation.

.NET unit and integration projects run separately in
`.github/workflows/dotnet-tests.yml` through
`dotnet test --solution agent-toolkit.slnx`.
