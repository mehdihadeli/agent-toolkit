# Planning

Durable task tracking for long-running coding work. The `durable-plans` skill
uses **Markdown-first recovery with an evidence journal underneath**. Agents read
bounded current context and focused task details; scripts maintain consistent
state and regenerate readable planning files. Plans live in the user's workspace,
not inside the installed plugin.

## Design

The useful unit is a verified task, not a checked box. Each task has an observable
acceptance condition, explicit dependencies, a state, and a concrete next action.
Completion requires recorded passing evidence. Advancing work invalidates that
evidence. Reopening a completed premise invalidates downstream work transitively.
Lasting decisions retain rationale and sources independently of recent notes.
Finishing tasks does not finish a plan: explicit final review must address the
recorded success criteria and scope constraints.

Independent plans have independent IDs and journals. An expected revision and
exclusive writer lock prevent cooperating writers from silently overwriting each
other. After context loss, replay the journal instead of trusting an outdated
summary. Missing or stale Markdown views can be rebuilt without changing history.
Validated batches reduce repeated tool calls when persisting related updates.

```text
<workspace>/.plans/<plan-id>/
	checkpoint.md   compact current state, ready work, blockers, next action
	plan.md         full scope, success criteria, tasks, acceptance, final review
	decisions.md    lasting decisions, rationale, and sources
	progress.md     readable chronological outcomes, failures, and verification
	events.jsonl    authoritative structured history, managed by the runtime
```

All Markdown files are generated, not independently editable sources. Each carries
a journal revision. Resume replays authoritative state; task context retains full
details without flooding the agent with unrelated completed work.

### Continuous Execution

During an active task, the skill instructs the agent to persist updates after
meaningful edits, checks, discoveries, decisions, and blockers, and before task
switches or handoff. Progress includes outcomes, artifact references, and an
executable next action. The agent continues ready work until blocked, paused, or
finished. This is an agent workflow contract, not an autonomous background monitor.

This is an original implementation informed by the general need for persistent
planning. It does not reuse the reference project's text, code, assets, hooks,
or three-document protocol. It makes no claim that event sourcing itself is new.

## Use

Read [worked examples](skills/durable-plans/examples.md) for investigation,
delivery, migration, research, handoff, and recovery. Four
[tested starter profiles](skills/durable-plans/templates/README.md) seed scoped,
dependency-ordered tasks through the existing runtime without inventing progress.

Ask your coding agent:

> Use durable-plans to track this migration across sessions. Preserve scope,
> acceptance checks, decisions, blockers, and the next executable action.

Later:

> Resume plan api-migration from its journal. Reconcile recorded progress with
> current files before continuing.

Claude and Codex use this plugin's marketplace metadata. Other skill-capable
hosts can load [the canonical skill directory](skills/durable-plans/SKILL.md)
through their supported skill-loading mechanism. Optional Claude Code hooks can
restore context automatically; other hosts require explicit resume. No background
process runs.

### Optional Claude Recovery

With this plugin installed in Claude Code, set both environment variables before
starting or restarting the host:

```bash
export DURABLE_PLANS_HOOKS=1
export DURABLE_PLANS_PLAN=api-migration
```

Select an existing plan ID explicitly. The adapter reads only
`.plans/<selected-id>/events.jsonl` under the hook payload's working directory.
It does not search parent directories, choose among plans, or create missing
plans. Start the host in the workspace containing the selected `.plans` directory.
For independent sessions, set the plan ID separately in each host's environment.
Unset `DURABLE_PLANS_HOOKS` or set it to `0` to disable recovery.

Claude discovers [the hook registration](hooks/hooks.json) at the plugin's default
hook location. The bundled commands stay silent and do not read plan storage
unless `DURABLE_PLANS_HOOKS` is exactly `1`. Node.js 22.12+ must be available on
the host's PATH.

| Event | Behavior |
| --- | --- |
| Session start, resume, clear, or compaction recovery | Replays the selected journal and injects bounded current context. |
| User prompt submission | Replays current state, including blockers, next action, and focused decisions. |
| Before Write, Edit, or Bash | Adds a short persistence reminder without replaying the journal. |
| Before compaction or at stop | Emits a user-visible advisory about recording progress; does not make the agent continue. |

Recovery is context restoration, not execution authorization. The adapter never
changes journals, refreshes Markdown, steals locks, runs recorded commands, starts
tasks, or blocks stopping. Agents must still reconcile recorded state with current
files and persist actual progress. Work never recorded before interruption cannot
be recovered. Compaction and stop advisories are not guaranteed model instructions
or automatic saves; tool-boundary reminders provide guidance while work is active.

Injected records are JSON-framed as untrusted data, with a 14,000-character context
ceiling; relevant decision excerpts and checkpoint fields may be truncated. Read
full scope and applicable decisions through the runtime before changing approach.
The adapter rejects linked plan storage, journals over 2 MiB, and hook inputs over
1 MiB. Missing or corrupt journals produce a nonblocking warning without repair
or fallback. Each hook has a five-second host timeout; timeouts can leave context
unrestored. Larger plans remain available through manual resume.

This adapter targets Claude Code's plugin hook contract only. Codex and Copilot
still use manual resume; installing the plugin does not add hooks to those hosts.

### Manual Runtime

Requires Node.js 22.12+. No dependency installation or server is needed.
From the repository root:

```bash
node plugins/planning/skills/durable-plans/scripts/plan.mjs init . api-migration "Migrate API; preserve public response schema"
node plugins/planning/skills/durable-plans/scripts/plan.mjs resume . api-migration
```

Record scope and success criteria before starting tasks. Use `task` for focused
details and `batch` for related updates, with the exact revision shown by `resume`.
See the
[command contract](skills/durable-plans/references/commands.md) for event examples,
file-based JSON input, state rules, concurrency, and interrupted-write recovery.

The runtime does not change Git ignore settings. Decide with the user whether
plans are private local artifacts or reviewed team records. Do not log secrets.
The evidence gate checks structure, not whether a claimed test actually ran;
the agent must inspect real results. Journals are not tamper-proof audit logs.

## Validation

Run deterministic tests from the repository root:

```bash
node --test tests/planning/scripts/durable-plans/*.test.mjs
python tools/validate_repository.py
node node_modules/@microsoft/vally-cli/dist/index.js lint .
waza check plugins/planning/skills/durable-plans
waza run tests/planning/waza/eval.yaml --no-cache
```

Run behavioral evaluations with configured Copilot/BYOK credentials:

```bash
VALLY_EVAL_SPEC=tests/planning/vally/eval.yaml mise run vally-eval-copilot-local
```

Alternatively use Vally directly with the spec's BYOK credential exported:

```bash
node node_modules/@microsoft/vally-cli/dist/index.js eval --eval-spec tests/planning/vally/eval.yaml --workers 1 --require-pass
```

Tests cover replay, lasting decisions, detailed Markdown recovery, bounded resume
context, batches, final review, evidence gates, dependency invalidation, isolation,
stale revisions, interrupted projections, malformed journals, CLI use, every starter
profile, and JSON state transitions embedded in the worked examples.
Hook tests cover read-only recovery, explicit selection, stale projections,
blocked-task decisions, bounded untrusted records, malformed input, linked storage,
advisory stopping, and the registered launcher from an install path with spaces.
Vally checks actual plan files using grader-only validation code, not merely
assistant claims, including cross-turn real-code execution and decision retention.
Its hook scenario exercises context interpretation, not live host event dispatch.
Waza mock tests check deterministic routing expectations;
they do not establish live-agent reliability. Behavioral evaluations require
a real model and are separate from the deterministic runtime suite.
