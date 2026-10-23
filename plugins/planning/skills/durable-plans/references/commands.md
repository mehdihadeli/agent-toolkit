# Command Contract

Replace `<script>` with the installed skill's `scripts/plan.mjs` path. Commands
work from any directory; pass the target workspace explicitly. Quote paths and
JSON according to the shell. Node.js 22.12+ is required; no packages are needed.

```text
node <script> init <workspace> <plan-id> <goal>
node <script> resume <workspace> <plan-id>
node <script> task <workspace> <plan-id> <task-id>
node <script> record <workspace> <plan-id> <expected-revision> <event-json>
node <script> batch <workspace> <plan-id> <expected-revision> <events-json-array>
node <script> refresh <workspace> <plan-id>
```

For shells with awkward JSON quoting, pass `@<event-file.json>` instead of
inline JSON. The runtime reads that file as JSON, without executing its contents.
Keep event files outside the installed plugin and remove sensitive drafts only
with the user's permission. All commands print a replayed checkpoint; errors
exit nonzero. `resume` is read-only and prints bounded current context. `status`
is an alias. `task` prints complete task details, applicable decisions, and twelve
recent task events. `refresh` rebuilds every generated Markdown view.

## Reading Order

1. Run `resume` to get current revision, progress counts, active action, ready
  queue, blockers, and relevant decisions without loading the whole history.
2. Run `task` for the selected task. Read applicable decisions before changing
  approach; read detailed plan sections when broader scope matters.
3. Read `progress.md` selectively for earlier results or rejected approaches.
  Do not repeatedly load the entire journal or all completed task details.
4. Cached Markdown must have the replayed revision. If views disagree or are
  missing, `refresh`; never edit generated Markdown to fix state.

## Events

Every record requires the exact current revision. IDs match
`[a-z][a-z0-9-]{0,63}`. Text fields must be nonempty, at most 16000 characters.
Task IDs are unique inside each plan. Unknown event types and fields are errors.
Arrays of text contain at most 100 entries. Batches contain 1 to 100 events.

```json
{"type":"scoped","constraints":["Preserve public API"],"success":["Boundary regression and workflow tests pass"]}
{"type":"added","task":"reproduce","title":"Reproduce expiry boundary","acceptance":"Equality boundary test fails before fix and passes after fix","dependsOn":[]}
{"type":"added","task":"integration","title":"Check token workflow","acceptance":"Token workflow integration test passes","dependsOn":["reproduce"]}
{"type":"started","task":"reproduce","next":"Run equality boundary test"}
{"type":"noted","task":"reproduce","note":"Boundary test fails at equality; token.test.mjs:18; exit 1"}
{"type":"decided","decision":"expiry-equality","task":"reproduce","summary":"Equality means expired","rationale":"Token validity contract uses an exclusive expiry boundary","source":"token-contract.md:18"}
{"type":"advanced","task":"reproduce","summary":"Added failing equality regression","artifacts":["token.test.mjs:18"],"next":"Change expiry comparison, then rerun boundary test"}
{"type":"verified","task":"reproduce","passed":true,"evidence":"node --test token.test.mjs; exit 0; 4 tests passed"}
{"type":"completed","task":"reproduce"}
{"type":"started","task":"integration","next":"Run token workflow integration test"}
{"type":"blocked","task":"integration","reason":"Local test service unavailable","next":"Ask owner to start local test service, then rerun workflow test"}
{"type":"reopened","task":"reproduce","reason":"New failing boundary case invalidates earlier result","next":"Add regression test and revalidate affected dependents"}
```

These are individual events, not a JSON array. Use one per `record`, reloading
the revision from each command's output, or send an array to `batch`. `created`
is reserved for `init`.

### Batch Example

After actually making the code change and inspecting the successful test result,
save this array to an event file and submit it with `batch`. Do not copy example
evidence into real work without running its check.

```json
[
  {"type":"advanced","task":"reproduce","summary":"Changed expiry comparison","artifacts":["token.mjs:12"],"next":"Review boundary test result"},
  {"type":"verified","task":"reproduce","passed":true,"evidence":"node --test token.test.mjs; exit 0; 4 tests passed"},
  {"type":"completed","task":"reproduce"}
]
```

```text
node <script> batch <workspace> <plan-id> <revision> @<updates.json>
```

The entire batch is validated before append; an invalid event writes nothing.
The revision advances once per event, not once per batch. Batches are not
crash-atomic transactions: interruption can persist a valid prefix or partial
tail. Replay and reconcile after an uncertain result; never blindly resubmit.

## State Rules

- `scoped`: records scope constraints and at least one plan success criterion.
  Use before starting work; subsequent scope changes require all tasks pending.
  Obtain user approval before expanding requested scope.
- `decided`: retains a decision by stable `decision` ID, with summary, rationale,
  and source. Optional task selects relevance; omitted task means whole plan.
  Reusing an ID replaces its current version without deleting earlier history.
  A new decision clears final closure; reopen affected work if its premise changed.
- `added`: creates a pending task; dependencies must already exist. This keeps
  the graph acyclic without a separate graph editor.
- `started`: pending or blocked to active; dependencies must be done, and no
  other task may be active. Clears prior blocker and verification.
- `advanced`: active stays active; updates next action and clears verification.
  Include `summary` and `artifacts` for meaningful changes; older minimal events
  with only `next` remain readable.
- `noted`: appends a concise observation for any existing task.
- `blocked`: active to blocked; records reason and unblock action, clears evidence.
- `verified`: active only; replaces latest verification with PASS or FAIL.
- `completed`: active to done, only after latest verification is PASS.
- `reopened`: done to pending; also resets every transitive dependent, even
  completed or active ones. Records reason and next action for revalidation.
- `closed`: records plan-level final evidence after all tasks are done and
  success criteria exist. Evidence must address every success criterion, scope
  constraint, and required delivery check. A task PASS is not a final review.
  Adding tasks, reopening work, changing decisions, or revising scope clears closure.

Example final event, only after actual final review:

```json
{"type":"closed","evidence":"Reviewed public API diff: unchanged. node --test token.test.mjs workflow.test.mjs; exit 0; all tests passed. Both success criteria satisfied."}
```

## Files And Failure Semantics

```text
<workspace>/.plans/<plan-id>/
  events.jsonl       authoritative numbered, timestamped event history
  checkpoint.md      bounded resume context and next actions
  plan.md            complete scope, success criteria, tasks, and final review
  decisions.md       lasting decisions with rationale and sources
  progress.md        complete readable progress and verification history
  writer.lock        exclusive transient writer lock
  *.md.tmp           transient projection writes
```

No global state, automatic Git changes, network requests, or background work.
Retain the whole journal for audit. Resume shows up to five ready tasks, five
blockers, five relevant decisions, three recent notes, and three current artifact
references. Long values are explicitly truncated in resume only. Full tasks,
decisions, notes, and artifacts remain in the detailed views and journal. Lasting
decisions do not expire as recent notes roll off. Log at meaningful boundaries;
this is a task journal, not a high-volume telemetry store.

Writers take an exclusive lock and reject stale revisions. Each event is
flushed before generated views are replaced via rename. Checkpoint is replaced
last. Every view carries its revision; the set is not a multi-file atomic commit.
Transient Windows rename locks get bounded retries without repeating events.
A crash may leave mixed view revisions, a lock, temporary files, or a partial
journal tail. Replay rejects
invalid JSON, incomplete tails, sequence gaps, and invalid transitions. No
automatic lock stealing or truncation occurs. These files are not tamper-proof,
and locks do not protect against external editors. Use a trusted local workspace,
not an untrusted symlink tree, shared network filesystem, or distributed writers.
The runtime does not guarantee survival of storage hardware failure.
