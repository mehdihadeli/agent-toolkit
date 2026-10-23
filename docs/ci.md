# Continuous Integration

GitHub Actions separates build/release, evaluation, harness, documentation,
trigger evaluation, and labeling workflows. Build/release permissions are
read-only except for the release job. See [Versioning](versioning.md) for the
NBGV version contract and Release Drafter behavior.

## Workflow map

| Workflow          | File                                 | Purpose                                                                                   |
| ----------------- | ------------------------------------ | ----------------------------------------------------------------------------------------- |
| Build-Test-Publish | `.github/workflows/build-and-publish.yml` | Test .NET plugins, calculate NBGV versions, and update GitHub releases. |
| Evaluation        | `.github/workflows/evaluation.yml`   | Validate repository metadata, lint Vally specs, and run prompt-driven plugin evaluations. |

## Build and release workflow

The `Build-Test-Publish` workflow runs for pull requests, pushes to `main`, and
`v*` tags. It can also be started manually with `workflow_dispatch`.

Its build/test job:

1. Checks out the repository.
2. Installs the SDK selected by `global.json`.
3. Runs `dotnet test --solution agent-toolkit.slnx --configuration Release`.

After tests pass, `main` and tag runs calculate versions using the pinned NBGV
tool and full Git history. Eligible previews and RCs update draft prereleases;
stable tags publish releases. Bootstrap preview height zero is validation-only.
The workflow publishes release notes, not NuGet packages or binaries.

This workflow covers executable .NET plugins. Live Tavily SDK tests are off by
default because they consume API credits. To enable them, configure the
`TAVILY_API_KEY` repository secret, then manually run `Build-Test-Publish` with
the `run_live_tests` checkbox selected. The test step fails if the secret is
missing rather than silently skipping the requested live tests. Pull requests
and automatic pushes never enable these tests or receive the Tavily secret.
For local runs, set `TAVILY_RUN_LIVE_TESTS=1` and `TAVILY_API_KEY`.

## Evaluation workflow

The `Evaluation` workflow runs for relevant pull requests and pushes to `main`.
It also supports manual execution and runs on a weekly schedule. It has two
jobs:

### Lint job

The `Vally lint` job:

1. Installs mise, Node.js 22, and the repository-pinned Vally CLI and Copilot CLI.
2. Uses repository-local binaries so Vally resolves the matching Copilot
   platform package.
3. Runs `mise run validate` to validate manifests, marketplace paths, skill
   frontmatter, and local Markdown links.
4. Runs `mise run vally-lint` to validate skill and evaluation configuration.

### Evaluation job

The `Run Vally evaluation suite` job starts after lint succeeds:

1. Installs the repository-pinned Vally CLI and GitHub Copilot CLI with
   `npm ci`, then invokes `mise run vally-eval` so it uses the same command as
   local development without depending on global npm modules.
1. Installs the repository-pinned Vally CLI and Copilot CLI with
   `npm ci`, then invokes `mise run vally-eval-copilot-ci` without depending on
   global npm modules.
1. Installs the .NET SDK selected by `global.json`.
1. Vally launches the C# Search MCP through the named `search-mcp` stdio
   environment in `.vally.yaml`.
1. Runs the complete `plugin-evals` suite with `mise run vally-eval-copilot-ci`.
   CI executes each eval file one at a time, continues after individual eval
   failures to collect the full report, and fails the job when any eval fails.
1. When Claude is enabled, runs the same suite sequentially through
   `mise run vally-eval-claude`.
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
mise run check
```

Run default Copilot evaluations:

```bash
mise run vally-eval-copilot-ci
```

For local evaluation with both executors, use `mise run vally-eval`. It runs all
Copilot evals followed by all Claude Code evals and reports failure after both
runs complete.

Run .NET tests:

```bash
dotnet test --solution agent-toolkit.slnx
```

Run Vally with Copilot:

```bash
mise run vally-eval
```

For a global Vally installation, set `VALLY=vally` before running
`mise run vally-eval`. The task still supplies `COPILOT_CLI_PATH` from the
repository's native Copilot package, avoiding the Windows npm-shim resolution
problem.

Run Vally with Claude after building the local executor and authenticating
Claude Code:

```bash
npm ci
npm run build --prefix tools/vally-executor-claude
claude login
mise run vally-eval-claude
```

Search MCP evaluations launch the local C# stdio MCP through Vally and require
its provider credentials. See [plugin-eval.md](plugin-eval.md) for focused
evaluations.

Live Tavily SDK tests require both `TAVILY_RUN_LIVE_TESTS=1` and
`TAVILY_API_KEY`. Normal CI runs set the flag to `0`, so live tests are reported as
skipped rather than making network calls.
