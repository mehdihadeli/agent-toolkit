# Vally Claude Code Executor

Custom Vally executor that runs repository eval specs through the Claude Code CLI. It complements Vally's built-in `copilot-sdk` executor; Vally runs one executor per invocation.

## Requirements

- Node.js 22.12 or newer
- Vally CLI 0.14.x
- Claude Code CLI installed and available as `claude`
- Claude provider credentials exported in the shell or CI job that runs `vally`

Check the CLI installation before running an eval:

```bash
claude --version
```

## Build

```bash
cd tools/vally-executor-claude
npm install
npm run build
cd ../..
```

## Configure the Provider

Provider credentials follow [Vally's BYOK convention](https://microsoft.github.io/vally/reference/eval-spec/#executor-config--byok): configuration stores an
environment-variable name, never a literal secret. The variable is read from
the environment of the `vally` process when each trial starts.

The local wrapper also exports standard variables from `.env` directly. Claude
Code consumes `ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL`, and
`ANTHROPIC_API_KEY` from that inherited process environment. This lets a Claude
eval receive all three values from `.env`:

```yaml
defaults:
  executor: claude-cli
```

With this form, `ANTHROPIC_MODEL` selects the model, while
`ANTHROPIC_BASE_URL` and `ANTHROPIC_API_KEY` configure Claude Code. The
executor-level `model` or Vally `defaults.model` overrides `ANTHROPIC_MODEL`
when explicitly provided.

An optional provider block applies Vally-style validation and supports a
different credential variable name:

```bash
export ANTHROPIC_API_KEY="..."
```

```yaml
defaults:
  executor:
    name: claude-cli
    config:
      provider:
        apiKeyEnv: ANTHROPIC_API_KEY
```

To make the model and endpoint explicit in the eval while keeping the secret
out of YAML, use `defaults.model`, a literal `provider.baseUrl`, and
`provider.apiKeyEnv`:

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

`baseUrl` is a literal URL and `apiKeyEnv` is the name of an environment
variable. Values such as `baseUrl: ANTHROPIC_BASE_URL` are not interpolated.
If `model` or `baseUrl` is omitted, Claude Code receives
`ANTHROPIC_MODEL` or `ANTHROPIC_BASE_URL` from the inherited process
environment.

Supported provider fields are `baseUrl`, `apiKeyEnv`, and `bearerTokenEnv`.
`bearerTokenEnv` takes precedence over `apiKeyEnv`; if both are set, the API-key
variable is not read. A configured but unset variable fails that trial.

`agent_environment.env` is applied only to the spawned Claude process. It is not
used to resolve `apiKeyEnv` or `bearerTokenEnv`:

```yaml
agent_environment:
  env:
    # Visible to Claude, but not used for Vally provider lookup.
    LOG_LEVEL: debug
```

For local development, use the repository mise task to load an ignored `.env`
file before Vally starts. For CI, use the CI secret/environment mechanism. The
executor itself does not search parent directories, read `.env` files, or read
Claude settings files.

### Provider approaches

Choose one of these approaches for a Claude evaluation:

1. **Inherited environment:** set `ANTHROPIC_MODEL`, `ANTHROPIC_BASE_URL`, and
   `ANTHROPIC_API_KEY` in `.env` or CI, then use `defaults.executor: claude-cli`.
   This keeps all provider values outside the eval spec.
1. **Explicit eval configuration:** set `defaults.model` and a literal
   `provider.baseUrl`, and use `provider.apiKeyEnv` for the credential. This
   makes model and endpoint visible and reproducible while keeping the secret
   outside YAML.
1. **Bearer-token authentication:** use `bearerTokenEnv` instead of
   `apiKeyEnv` when the Claude endpoint expects `ANTHROPIC_AUTH_TOKEN`:

```yaml
defaults:
  executor:
    name: claude-cli
    config:
      provider:
        baseUrl: https://api.anthropic.com
        bearerTokenEnv: ANTHROPIC_AUTH_TOKEN
```

`bearerTokenEnv` takes precedence if both credential fields are present.

1. **CLI behavior configuration:** use `command`, `permissionMode`,
   `maxBudgetUsd`, or `extraArgs` under `executor.config` to control the Claude
   CLI invocation. These options change how Claude runs; they do not load
   provider values from YAML environment-variable names.

The mise tasks load `.env` before Vally starts. The explicit task
`vally-eval-claude-local` passes `--executor claude-cli`; the
`vally-eval-claude-default-local` target omits that flag and lets
`defaults.executor` select the custom executor.

## Run an Evaluation

Run local evaluations from repository root. These targets load the root `.env`
before starting Vally:

```bash
VALLY_EVAL_SPEC=tests/skill-guide/vally/eval.yaml mise run vally-eval-claude-local
VALLY_EVAL_SPEC=tests/skill-guide/vally/eval.yaml mise run vally-eval-copilot-local
```

CI evaluations use exported job variables and do not load `.env`:

```bash
VALLY_EVAL_SPEC=tests/skill-guide/vally/eval.yaml mise run vally-eval-claude-ci
VALLY_EVAL_SPEC=tests/skill-guide/vally/eval.yaml mise run vally-eval-copilot-ci
```

`vally-eval` and `vally-eval-copilot` remain aliases for the local Copilot
target. `vally-eval-claude` and `vally-eval-claude-cli` remain aliases for the
local Claude target.

The mise tasks support `VALLY_ENV_FILE`, `VALLY_RUNS`, `VALLY_WORKERS`,
`VALLY_EVAL_SPEC`, and `VALLY_SUITE` overrides. Locally, the internal wrapper
reads `.env` by default; in CI, it uses exported job variables and does not
require a `.env` file. It fails before Vally starts when the executor has no
usable credential:

- Claude: `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN`
- Copilot: `COPILOT_GITHUB_TOKEN` or `OPENAI_API_KEY`

`ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL`, `OPENAI_BASE_URL`, and
`OPENAI_MODEL` are optional and are passed through when set.

The executor invokes:

```text
claude --print --verbose --output-format stream-json
```

It stages MCP configuration when an eval declares MCP servers and translates Claude messages, tool calls, tool results, token usage, errors, and timeouts into Vally trajectory events.

## Executor Options

Supported executor configuration keys:

- `command`: Claude CLI executable; defaults to `claude`.
- `provider`: Provider configuration with `baseUrl`, `apiKeyEnv`, or `bearerTokenEnv`.
- `permissionMode`: Claude permission mode; defaults to `acceptEdits`.
- `allowDangerouslySkipPermissions`: Adds Claude's dangerous permission flags when `true`.
- `maxBudgetUsd`: Positive maximum spend passed to Claude Code.
- `extraArgs`: Additional Claude CLI arguments.

Use `allowDangerouslySkipPermissions` only in an isolated, disposable evaluation environment.

## Test

Run the build and Jest suite:

```bash
npm test --prefix tools/vally-executor-claude
```

Tests use in-memory environment maps and do not read real user credentials.

## Copilot Comparison

The built-in `copilot-sdk` executor uses the same Vally process-environment rule
for its BYOK provider block:

```yaml
defaults:
  model: qwen3
  executor:
    name: copilot-sdk
    config:
      provider:
        baseUrl: http://localhost:11434/v1
        apiKeyEnv: OLLAMA_KEY
```

Export `OLLAMA_KEY` before running `vally`; do not put the secret in
`agent_environment.env`. A variant can override `/defaults/executor` and
`/defaults/model` to compare this provider with another executor. A variant
without `config.provider` uses the executor's normal authentication chain.

For a plain Copilot eval, run the same spec without this plugin and use
`--executor copilot-sdk`.
