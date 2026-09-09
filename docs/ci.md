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
2. Optionally installs Claude Code and builds
   `tools/vally-executor-claude` when repository variable
   `ENABLE_CLAUDE_EVAL` equals `true`.
3. Installs the .NET SDK selected by `global.json`.
4. Vally launches the C# Search MCP through the named `search-mcp` stdio
   environment in `.vally.yaml`.
5. Runs the complete `plugin-evals` suite with `make vally-eval`.
6. When Claude is enabled, runs the same suite sequentially through
   `make vally-eval-claude`.
7. Uploads results from `.work/vally/results/` as a workflow artifact for 14
   days. Copilot and Claude runs use separate result directories.

One job is sufficient because both executors run sequentially. Vally launches
the Search MCP for each evaluation through its stdio environment.

## Credentials and settings

Required for the default Copilot evaluation:

- `COPILOT_GITHUB_TOKEN` secret, with `GITHUB_TOKEN` used as fallback.
- `TAVILY_API_KEY` secret for search research scenarios.

For Copilot SDK BYOK evaluations, the eval specs use `apiKeyEnv: OPENAI_API_KEY`
to read the provider secret from the Vally process environment. The provider
`baseUrl`, `model`, and `wireModel` remain explicit values in each eval spec;
`OPENAI_BASE_URL` and `OPENAI_MODEL` are documented local settings but are not
automatically interpolated by Vally. See the [Vally BYOK reference](https://microsoft.github.io/vally/reference/eval-spec/#executor-config--byok).

Optional Claude evaluation:

- Repository variable `ENABLE_CLAUDE_EVAL=true`.
- `ANTHROPIC_API_KEY` secret.

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
make vally-eval
```

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
npm ci --prefix tools/vally-executor-claude
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
