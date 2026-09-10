# Continuous Integration

GitHub Actions uses two workflows. Both run on `ubuntu-latest`, use read-only
repository permissions, and cancel older runs for the same branch or pull
request when a newer run starts.

## Workflow map

| Workflow          | File                                 | Purpose                                                                                   |
| ----------------- | ------------------------------------ | ----------------------------------------------------------------------------------------- |
| .NET plugin tests | `.github/workflows/dotnet-tests.yml` | Build and run all .NET unit and integration tests.                                        |
| Evaluation        | `.github/workflows/evaluation.yml`   | Validate repository metadata, lint Vally specs, and run prompt-driven plugin evaluations. |

## .NET plugin tests

The `.NET plugin tests` workflow runs for pull requests and pushes to `main`
that change plugin agents or MCPs, unit or integration tests, the solution, the
SDK selection, or the workflow itself. It can also be started manually with
`workflow_dispatch`.

Its single job:

1. Checks out the repository.
2. Installs the SDK selected by `global.json`.
3. Runs `dotnet test --solution agent-toolkit.slnx`.

This workflow covers executable .NET plugins. Live Tavily SDK tests are not
part of normal pull-request runs because they consume API credits. Start this
workflow manually and set `Run live Tavily SDK integration tests` when those
tests are needed; the job requires the `TAVILY_API_KEY` secret.

## Evaluation workflow

The `Evaluation` workflow runs for relevant pull requests and pushes to `main`.
It also supports manual execution and runs on a weekly schedule. It has two
jobs:

### Lint job

The `Vally lint` job:

1. Installs Node.js 22 and the repository-pinned Vally CLI and Copilot CLI.
2. Uses repository-local binaries so Vally resolves the matching Copilot
   platform package.
3. Runs `make validate` to validate manifests, marketplace paths, skill
   frontmatter, and local Markdown links.
4. Runs `make vally-lint` to validate skill and evaluation configuration.

### Evaluation job

The `Run Vally evaluation suite` job starts after lint succeeds:

1. Installs the repository-pinned Vally CLI and GitHub Copilot CLI with
   `npm ci`, then invokes `make vally-eval` so it uses the same command as
   local development without depending on global npm modules.
1. Installs the repository-pinned Vally CLI and Copilot CLI with
   `npm ci`, then invokes `make vally-eval-copilot-ci` without depending on
   global npm modules.
1. Installs the .NET SDK selected by `global.json`.
1. Vally launches the C# Search MCP through the named `search-mcp` stdio
   environment in `.vally.yaml`.
1. Runs the complete `plugin-evals` suite with `make vally-eval-copilot-ci`.
   CI executes each eval file one at a time, continues after individual eval
   failures to collect the full report, and fails the job when any eval fails.
1. When Claude is enabled, runs the same suite sequentially through
   `make vally-eval-claude`.
1. Uploads results from `.work/vally/results/` as a workflow artifact for 14
   days. Copilot and Claude runs use separate result directories.

One job is sufficient because both executors run sequentially. Vally launches
the Search MCP for each evaluation through its stdio environment.

## Credentials and settings

Required for the current Copilot evaluation specs:

- `OPENAI_API_KEY` secret for the BYOK provider configured in the eval specs.
- Each BYOK eval declares its own provider `baseUrl` and `model`. The runner
  does not duplicate those settings; endpoint preflight is skipped unless an
  `OPENAI_BASE_URL` is explicitly provided.
- `TAVILY_API_KEY` secret for search research scenarios.

Native Copilot authentication remains supported through the
`COPILOT_GITHUB_TOKEN` secret, with `GITHUB_TOKEN` used as fallback, when an
eval spec does not configure a BYOK provider.

For Copilot SDK BYOK evaluations, the eval specs use `apiKeyEnv: OPENAI_API_KEY`
to read the provider secret from the Vally process environment. The provider
`baseUrl`, `model`, and `wireModel` remain explicit values in each eval spec;
`OPENAI_BASE_URL` and `OPENAI_MODEL` are documented local settings but are not
automatically interpolated by Vally. See the [Vally BYOK reference](https://microsoft.github.io/vally/reference/eval-spec/#executor-config--byok).

Claude evaluation is mandatory in the evaluation job:

- `ANTHROPIC_API_KEY` secret.
- `ANTHROPIC_BASE_URL` repository variable for the Anthropic-compatible
  gateway used by the eval model.
- `ANTHROPIC_MODEL` repository variable.

The current eval specs declare `deepseek-v4-flash`, so CI must provide an
Anthropic-compatible `ANTHROPIC_BASE_URL` for that model. `ANTHROPIC_API_KEY`
alone targets Anthropic's public API and does not make the DeepSeek model
available.

Claude evaluation runs in the same evaluation job as Copilot, after the
Copilot run, and uses the same Search MCP process. .NET tests run once because
they are independent of the evaluator host; they are not duplicated for
Claude and Copilot.

Search providers are disabled by default in the Search MCP. The current search
evaluation requires Tavily, so enable it explicitly with repository variable
`ENABLE_TAVILY_SEARCH=true` when using that evaluation.

Do not place credentials in Vally YAML, fixtures, workflow files, or source
code.

## Local equivalents

Run static checks:

```bash
make check
```

Run default Copilot evaluations:

```bash
make vally-eval-copilot-ci
```

For local evaluation with both executors, use `make vally-eval`. It runs all
Copilot evals followed by all Claude Code evals and reports failure after both
runs complete.

Run .NET tests:

```bash
dotnet test --solution agent-toolkit.slnx
```

Run Vally with Copilot:

```bash
make vally-eval
```

For a global Vally installation, use `make VALLY=vally vally-eval`. The
Makefile still supplies `COPILOT_CLI_PATH` from the repository's native
Copilot package, avoiding the Windows npm-shim resolution problem.

Run Vally with Claude after building the local executor and authenticating
Claude Code:

```bash
npm ci
npm run build --prefix tools/vally-executor-claude
claude login
make vally-eval-claude
```

Search MCP evaluations launch the local C# stdio MCP through Vally and require
its provider credentials. See [plugin-eval.md](plugin-eval.md) for focused
evaluations.

Live Tavily SDK tests require both `TAVILY_RUN_LIVE_TESTS=1` and
`TAVILY_API_KEY`; the manual workflow input configures the environment for
them. Normal .NET runs leave the flag unset, so live tests are reported as
skipped rather than making network calls.
