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

The `.NET plugin tests` workflow runs for pull requests that change plugin
agents or MCPs, unit or integration tests, the solution, the SDK selection, or
the workflow itself. It can also be started manually with `workflow_dispatch`.

Its single job:

1. Checks out the repository.
2. Installs the SDK selected by `global.json`.
3. Runs `dotnet test --solution agent-toolkit.slnx`.

This workflow covers executable .NET plugins. It does not run Vally skill or
prompt evaluations.

## Evaluation workflow

The `Evaluation` workflow runs when plugin, test, tool, Vally configuration, or
SDK files change. It also supports manual execution and runs on a weekly
schedule. It has two jobs:

### Lint job

The `Vally lint` job:

1. Installs Node.js 22 and Vally CLI 0.14.
2. Installs GitHub Copilot CLI and exposes its executable through
   `COPILOT_CLI_PATH`.
3. Runs `python tools/validate_repository.py` to validate manifests, marketplace
   paths, skill frontmatter, and local Markdown links.
4. Runs `vally lint .` to validate skill and evaluation configuration.

### Evaluation job

The `Run Vally evaluation suite` job starts after lint succeeds:

1. Installs Vally and GitHub Copilot CLI.
2. Optionally installs Claude Code and builds
   `tools/vally-executor-claude` when repository variable
   `ENABLE_CLAUDE_EVAL` equals `true`.
3. Installs the .NET SDK selected by `global.json`.
4. Starts the Search MCP at `http://127.0.0.1:6243` and waits for its health
   endpoint.
5. Runs the complete `plugin-evals` suite with Copilot through
   `--executor copilot-sdk`.
6. When Claude is enabled, runs the same suite sequentially through
   `--executor claude-cli`.
7. Stops the Search MCP, even when evaluation fails.
8. Uploads results from `.work/vally/results/` as a workflow artifact for 14
   days. Copilot and Claude runs use separate result directories.

One job is sufficient because both executors run sequentially and share the
same local MCP process. Vally still requires one executor per invocation.

## Credentials and settings

Required for the default Copilot evaluation:

- `COPILOT_GITHUB_TOKEN` secret, with `GITHUB_TOKEN` used as fallback.
- `TAVILY_API_KEY` secret for search research scenarios.
- `BING_SEARCH_API_KEY` secret for Bing-backed search scenarios.

Optional Claude evaluation:

- Repository variable `ENABLE_CLAUDE_EVAL=true`.
- `ANTHROPIC_API_KEY` secret.

Do not place credentials in Vally YAML, fixtures, workflow files, or source
code.

## Local equivalents

Run static checks:

```bash
python tools/validate_repository.py
vally lint .
```

Run .NET tests:

```bash
dotnet test --solution agent-toolkit.slnx
```

Run Vally with Copilot:

```bash
vally eval --executor copilot-sdk --suite plugin-evals --require-pass
```

Run Vally with Claude after building the local executor and authenticating
Claude Code:

```bash
npm ci --prefix tools/vally-executor-claude
npm run build --prefix tools/vally-executor-claude
claude login
vally eval \
  --executor-plugin ./tools/vally-executor-claude \
  --executor claude-cli \
  --suite plugin-evals \
  --require-pass
```

Search MCP evaluations require the local Search MCP and its provider
credentials. See [plugin-eval.md](plugin-eval.md) for focused evaluations.
