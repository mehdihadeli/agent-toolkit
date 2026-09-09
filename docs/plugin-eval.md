# Plugin Evaluation

This repository uses Vally for static validation and prompt-driven evaluation.

## Static validation

From repository root:

```bash
make vally-lint
```

Root `.vally.yaml` discovers evaluation files under `tests/*/vally/` and groups them in the `plugin-evals` suite.

Shared setup lives in named environments in `.vally.yaml`. An eval selects one
with `agent_environment` and keeps only its local fixtures in `environment`:

```yaml
agent_environment: docs-research
environment:
  files:
    - src: fixtures/task.md
      dest: task.md
```

This repository defines named environments for `docs-research`, `skill-guide`,
`dotnet-quality-agent`, and `search-mcp`.

## Focused evaluation

Run the default Copilot evaluation after installing repository dependencies:

```bash
npm ci
make vally-eval
```

Run the same spec through Claude Code with the repository executor:

```bash
cd tools/vally-executor-claude
npm install && npm run build
cd ../..
claude login
make vally-eval-claude
```

Use these executor commands for skill, agent, and MCP specs. Vally selects one
executor per invocation; it does not run both hosts from one command. The
agent specs stage custom agents into both host-specific directories.

Declare evaluation dependencies in each `eval.yaml` whenever Vally can own
their setup:

- Use `environment.skills` for skill directories.
- Use `environment.files` to stage Markdown agents into `.github/agents/` and
  `.claude/agents/`.
- Use `environment.mcpServers` with `type: stdio` for MCPs Vally should launch
  as child processes.
- Use `environment.mcpServers` with `type: http` or `type: sse` when the MCP is
  already hosted and Vally should connect to it.

This repository's normal Search MCP endpoint is ASP.NET Streamable HTTP, but
the Vally `search-mcp` environment uses the dedicated C# stdio host so Vally
can launch it as a child process. The Search eval files select that named
environment and do not need manual MCP startup.

Search MCP evaluations require the local server and provider credentials:

```bash
make vally-eval VALLY_EVAL_SPEC=tests/search/vally/mcp/eval.yaml
```

Search MCP stimuli are tagged by priority and cost. Run the two fast smoke
checks during inner-loop development:

```bash
make VALLY=vally VALLY_SUITE=search-smoke vally-eval
```

Run complete Search MCP coverage in CI:

```bash
make VALLY=vally VALLY_SUITE=search-ci vally-eval
```

Vally captures trajectories, token usage, tool calls, and wall time in the
results directory. Re-grade saved trajectories after changing graders without
rerunning the agent:

```bash
cat .work/vally/results/copilot/<run>/results.jsonl \
  | vally grade --eval-spec tests/search/vally/mcp/eval.yaml
```

Keep `VALLY_WORKERS=1` inside each Vally process for file-backed environments:
Vally's session filesystem provider is process-global. The full default suite
avoids blocking by running each eval file in its own process, up to four
processes at once. Change that limit with `VALLY_PROCESSES`:

```bash
make VALLY=vally VALLY_PROCESSES=2 vally-eval
```

Increase confidence with repeated trials inside each isolated process instead:

```bash
make VALLY=vally VALLY_SUITE=search-smoke VALLY_RUNS=3 vally-eval
```

## Evaluation rules

- Keep fixtures beside the evaluation that uses them.
- Use realistic stimuli that exercise activation and output behavior.
- Do not put secrets in YAML or fixtures; use environment variables.
- Keep Vally evaluations separate from executable xUnit tests.
- Prefer deterministic graders for CI; reserve LLM judge graders and repeated
  runs for outer-loop or nightly analysis.
- Tag stimuli with consistent `priority`, `area`, and `cost` values so suites
  can separate fast smoke checks from external, expensive scenarios.
- Add the relevant evaluation path to CI when introducing a new runtime requirement.

GitHub Actions runs lint and the `plugin-evals` suite in one evaluation job. It runs Copilot first, then optionally runs Claude Code in the same job with separate result directories. Set repository variable `ENABLE_CLAUDE_EVAL=true` and secret `ANTHROPIC_API_KEY` to enable the Claude step; the job installs Claude Code, builds the local executor, and runs the same suite through `claude-cli`.
