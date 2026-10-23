# Starter Profiles

These are original event batches, not editable copies of generated plan files.
Choose one profile, adapt it to the user's request, and apply it through the
[runtime](../scripts/plan.mjs). Every shipped profile is exercised by deterministic
runtime tests. No profile starts tasks, claims verification, or closes a plan.

| Profile | Use When | Initial Tasks |
| --- | --- | --- |
| [investigation.json](investigation.json) | A reported failure needs a bounded reproduction and correction. | Isolate, correct, validate impact. |
| [delivery.json](delivery.json) | A new workflow crosses implementation and integration boundaries. | Contract, working slice, resilience, delivery review. |
| [migration.json](migration.json) | A compatibility-sensitive transition needs rehearsal and recovery. | Baseline, recovery design, transition, rehearsal, readiness review. |
| [research.json](research.json) | A decision needs traceable evidence and a defensible synthesis. | Questions, evidence, synthesis. |

## Apply A Profile

1. Confirm the workspace, approved goal, and plan ID. Initialize only a new plan.
2. Read the chosen JSON profile. Tailor constraints, success criteria, task titles,
   and acceptance checks to real inputs, commands, artifacts, and delivery gates.
   Preserve dependency ordering when renaming tasks. Do not expand user scope.
3. Store the customized JSON array in the user's workspace, outside the installed
   plugin. It is an input draft, not authoritative state. Keep secrets out.
4. Replay `resume`, then submit the customized file with `batch` and that exact
   revision. The runtime validates all events before appending any.
5. Read the generated plan and select a ready task. If generic acceptance text
   remains unclear, resolve it before implementation rather than inventing checks.

```text
node <skill>/scripts/plan.mjs init <workspace> <plan-id> "Approved goal and boundaries"
node <skill>/scripts/plan.mjs batch <workspace> <plan-id> 1 @<workspace>/starter-events.json
node <skill>/scripts/plan.mjs resume <workspace> <plan-id>
```

For a disposable demonstration, an unmodified profile can be supplied directly:

```text
node <skill>/scripts/plan.mjs batch <workspace> <plan-id> 1 @<skill>/templates/investigation.json
```

Quote complete paths when they contain spaces. Replace angle-bracket placeholders;
they are not shell variables. Read the [command contract](../references/commands.md)
for JSON quoting, batch recovery, and state rules.

## Existing Plans

Do not apply a starter profile over an existing plan. Reuse current task IDs and
history. Add newly discovered work with `added`; reopen invalidated completed
tasks with `reopened`. Scope changes require all tasks pending and user approval
when they expand the original request. Profiles are suggestions, not authority
to deploy, delete data, change public contracts, or run external tools.

Generated Markdown layouts are owned by the runtime. Avoid hand-maintained
Markdown templates for those files: they would bypass validation and drift from
the journal. See [worked examples](../examples.md) for their use in real workflows.
