import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initPlan, readPlan, recordEvent, recordEvents, refreshPlan, renderPlan, renderTask } from '../../../../plugins/planning/skills/durable-plans/scripts/plan.mjs';

function session(context) {
  const root = mkdtempSync(join(tmpdir(), 'durable-plans-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  initPlan(root, 'repair', 'Repair token expiry without changing public API');
  return {
    root,
    file: name => join(root, '.plans', 'repair', name),
    read: () => readPlan(root, 'repair'),
    record: event => recordEvent(root, 'repair', readPlan(root, 'repair').revision, event),
  };
}

function add(plan, task, dependsOn = []) {
  plan.record({ type: 'added', task, title: `Implement ${task}`, acceptance: `${task} focused tests pass`, dependsOn });
}

function finish(plan, task) {
  plan.record({ type: 'started', task, next: `Run ${task} focused test` });
  plan.record({ type: 'verified', task, passed: true, evidence: 'node --test focused.test.mjs; exit 0; 3 passed' });
  plan.record({ type: 'completed', task });
}

test('journal replay recovers exact state and regenerates a lost checkpoint', context => {
  const plan = session(context);
  add(plan, 'boundary');
  plan.record({ type: 'started', task: 'boundary', next: 'Add equality boundary test' });
  plan.record({ type: 'noted', task: 'boundary', note: 'Equality is expired; source: token.cs:42' });
  const before = plan.read();
  rmSync(plan.file('checkpoint.md'));
  assert.deepEqual(refreshPlan(plan.root, 'repair'), before);
  assert.equal(readFileSync(plan.file('checkpoint.md'), 'utf8'), renderPlan(before));
  assert.match(renderPlan(before), /Add equality boundary test/);
});

test('completion requires evidence and latest verification must pass', context => {
  const plan = session(context);
  add(plan, 'boundary');
  plan.record({ type: 'started', task: 'boundary', next: 'Test boundary' });
  assert.throws(() => plan.record({ type: 'completed', task: 'boundary' }), /passing verification/);
  assert.throws(() => plan.record({ type: 'verified', task: 'boundary', passed: true, evidence: '' }), /nonempty/);
  plan.record({ type: 'verified', task: 'boundary', passed: true, evidence: 'Initial check passed' });
  plan.record({ type: 'verified', task: 'boundary', passed: false, evidence: 'Boundary regression failed' });
  assert.throws(() => plan.record({ type: 'completed', task: 'boundary' }), /passing verification/);
  assert.match(renderPlan(plan.read()), /Complete: false/);
});

test('dependencies and single active task bound execution', context => {
  const plan = session(context);
  add(plan, 'fix');
  add(plan, 'integration', ['fix']);
  assert.throws(() => plan.record({ type: 'started', task: 'integration', next: 'Run test' }), /unfinished/);
  plan.record({ type: 'started', task: 'fix', next: 'Reproduce' });
  assert.throws(() => plan.record({ type: 'started', task: 'integration', next: 'Run test' }), /active/);
  plan.record({ type: 'blocked', task: 'fix', reason: 'SDK unavailable', next: 'Ask owner to install SDK' });
  assert.equal(plan.read().tasks.fix.status, 'blocked');
  finish(plan, 'fix');
  finish(plan, 'integration');
  assert.match(renderPlan(plan.read()), /Complete: false/);
  assert.match(renderPlan(plan.read()), /review all success criteria/);
});

test('reopening invalidates completed transitive dependents', context => {
  const plan = session(context);
  add(plan, 'fix');
  add(plan, 'integration', ['fix']);
  add(plan, 'release', ['integration']);
  for (const task of ['fix', 'integration', 'release']) finish(plan, task);
  plan.record({ type: 'reopened', task: 'fix', reason: 'New failing boundary', next: 'Reproduce then revalidate dependents' });
  for (const task of Object.values(plan.read().tasks)) {
    assert.equal(task.status, 'pending');
    assert.equal(task.verification, null);
  }
});

test('stale writes and writer collisions never append', context => {
  const plan = session(context);
  const before = readFileSync(plan.file('events.jsonl'), 'utf8');
  assert.throws(() => recordEvent(plan.root, 'repair', 0, { type: 'added' }), /Stale revision/);
  writeFileSync(plan.file('writer.lock'), 'other writer');
  assert.throws(() => plan.record({ type: 'added' }), /EEXIST/);
  assert.equal(readFileSync(plan.file('events.jsonl'), 'utf8'), before);
});

test('rejects traversal, overwrite, unknown fields, missing dependencies and damaged journal', context => {
  const plan = session(context);
  assert.throws(() => initPlan(plan.root, '../escape', 'goal'), /Invalid plan/);
  assert.throws(() => initPlan(plan.root, 'repair', 'overwrite'), /EEXIST/);
  assert.throws(() => plan.record({ type: 'added', task: 'fix', title: 'Fix', acceptance: 'Test', dependsOn: ['missing'] }), /Dependencies/);
  assert.throws(() => plan.record({ type: 'created', goal: 'Replace', surprise: true }), /Unknown/);
  appendFileSync(plan.file('events.jsonl'), '{"revision":2');
  assert.throws(() => plan.read(), /incomplete tail/);
});

test('plans are isolated and empty plans are never complete', context => {
  const plan = session(context);
  initPlan(plan.root, 'other', 'Other work');
  add(plan, 'fix');
  assert.deepEqual(readPlan(plan.root, 'other').tasks, {});
  assert.match(renderPlan(readPlan(plan.root, 'other')), /Complete: false/);
});

test('advancing work invalidates prior evidence and persists the next action', context => {
  const plan = session(context);
  add(plan, 'fix');
  plan.record({ type: 'started', task: 'fix', next: 'Run baseline' });
  plan.record({ type: 'verified', task: 'fix', passed: true, evidence: 'Baseline passed' });
  plan.record({ type: 'advanced', task: 'fix', next: 'Change comparison and rerun boundary test' });
  assert.equal(plan.read().tasks.fix.verification, null);
  assert.equal(plan.read().tasks.fix.next, 'Change comparison and rerun boundary test');
  assert.throws(() => plan.record({ type: 'completed', task: 'fix' }), /passing verification/);
});

test('lasting decisions survive noisy progress and update without losing history', context => {
  const plan = session(context);
  add(plan, 'fix');
  plan.record({ type: 'decided', decision: 'expiry-rule', task: 'fix', summary: 'Equality means expired', rationale: 'Token contract', source: 'token.cs:42' });
  for (let index = 0; index < 12; index++) plan.record({ type: 'noted', task: 'fix', note: `Investigation ${index}` });
  assert.match(readFileSync(plan.file('decisions.md'), 'utf8'), /Equality means expired/);
  assert.match(renderTask(plan.read(), 'fix'), /Equality means expired/);
  plan.record({ type: 'decided', decision: 'expiry-rule', task: 'fix', summary: 'Use server clock', rationale: 'Updated contract', source: 'contract.md:18' });
  const decisions = readFileSync(plan.file('decisions.md'), 'utf8');
  assert.match(decisions, /Use server clock/);
  assert.doesNotMatch(decisions, /Equality means expired/);
  assert.match(readFileSync(plan.file('progress.md'), 'utf8'), /Equality means expired/);
});

test('all Markdown views rebuild at one revision with detailed progress and artifacts', context => {
  const plan = session(context);
  plan.record({ type: 'scoped', constraints: ['Preserve public API'], success: ['All boundary tests pass'] });
  add(plan, 'fix');
  plan.record({ type: 'started', task: 'fix', next: 'Reproduce boundary' });
  plan.record({ type: 'advanced', task: 'fix', summary: 'Reproduced equality failure', artifacts: ['token.test.mjs:18'], next: 'Fix comparison and rerun' });
  for (const name of ['checkpoint.md', 'plan.md', 'decisions.md', 'progress.md']) rmSync(plan.file(name));
  refreshPlan(plan.root, 'repair');
  for (const name of ['checkpoint.md', 'plan.md', 'decisions.md', 'progress.md']) {
    assert.match(readFileSync(plan.file(name), 'utf8'), new RegExp(`Revision: ${plan.read().revision}\\b`));
  }
  assert.match(readFileSync(plan.file('plan.md'), 'utf8'), /Preserve public API/);
  assert.match(readFileSync(plan.file('progress.md'), 'utf8'), /Reproduced equality failure/);
  assert.match(renderTask(plan.read(), 'fix'), /token.test.mjs:18/);
});

test('final closure requires success criteria, completed tasks and fresh review evidence', context => {
  const plan = session(context);
  assert.throws(() => plan.record({ type: 'closed', evidence: 'Claimed done' }), /all tasks done/);
  plan.record({ type: 'scoped', constraints: ['Preserve API'], success: ['Boundary tests pass'] });
  add(plan, 'fix');
  finish(plan, 'fix');
  assert.throws(() => plan.record({ type: 'closed', evidence: '' }), /nonempty/);
  plan.record({ type: 'closed', evidence: 'Reviewed success criteria; focused regression exit 0; API unchanged' });
  assert.match(renderPlan(plan.read()), /Complete: true/);
  plan.record({ type: 'reopened', task: 'fix', reason: 'New regression', next: 'Reproduce' });
  assert.match(renderPlan(plan.read()), /Complete: false/);
});

test('resume context is bounded while detailed plan retains every task', context => {
  const plan = session(context);
  for (let index = 0; index < 35; index++) add(plan, `task-${index}`);
  const summary = renderPlan(plan.read());
  assert.ok(summary.length < 6000);
  assert.match(summary, /35 ready/);
  assert.doesNotMatch(summary, /task-34/);
  assert.match(readFileSync(plan.file('plan.md'), 'utf8'), /task-34/);
  assert.match(renderTask(plan.read(), 'task-34'), /task-34 focused tests pass/);
});

test('validated batches reject all changes on invalid transitions and append ordered revisions on success', context => {
  const plan = session(context);
  const before = readFileSync(plan.file('events.jsonl'), 'utf8');
  const added = { type: 'added', task: 'fix', title: 'Fix boundary', acceptance: 'Boundary passes' };
  assert.throws(() => recordEvents(plan.root, 'repair', 1, [added, { type: 'completed', task: 'fix' }]), /passing verification/);
  assert.equal(readFileSync(plan.file('events.jsonl'), 'utf8'), before);
  const state = recordEvents(plan.root, 'repair', 1, [added,
    { type: 'started', task: 'fix', next: 'Run boundary test' },
    { type: 'advanced', task: 'fix', summary: 'Implemented comparison fix', next: 'Verify fix', artifacts: ['token.cs:42'] },
    { type: 'verified', task: 'fix', passed: true, evidence: 'node --test boundary.test.mjs; exit 0' },
    { type: 'completed', task: 'fix' }]);
  assert.equal(state.revision, 6);
  assert.equal(state.tasks.fix.status, 'done');
  assert.equal(state.closure, null);
  assert.throws(() => recordEvents(plan.root, 'repair', 1, [added]), /Stale/);
  assert.throws(() => recordEvents(plan.root, 'repair', 6, []), /1 to 100/);
});

test('many large artifact references cannot flood resume context', context => {
  const plan = session(context);
  add(plan, 'fix');
  plan.record({ type: 'started', task: 'fix', next: 'Verify artifacts' });
  plan.record({ type: 'advanced', task: 'fix', summary: 'Collected artifacts', next: 'Inspect detailed artifacts', artifacts: Array.from({ length: 100 }, (_, index) => `artifact-${index}: ${'x'.repeat(1000)}`) });
  assert.ok(renderPlan(plan.read()).length < 6000);
  assert.match(renderTask(plan.read(), 'fix'), /artifact-99/);
});

test('a committed event is recoverable if one generated view cannot be replaced', context => {
  const plan = session(context);
  writeFileSync(plan.file('decisions.md.tmp'), 'Preserved interrupted projection');
  assert.throws(() => plan.record({ type: 'added', task: 'fix', title: 'Fix', acceptance: 'Regression passes' }), /Event committed at revision 2/);
  assert.equal(plan.read().revision, 2);
  assert.equal(readFileSync(plan.file('decisions.md.tmp'), 'utf8'), 'Preserved interrupted projection');
  rmSync(plan.file('decisions.md.tmp'));
  refreshPlan(plan.root, 'repair');
  assert.equal(plan.read().history.length, 2);
  assert.match(readFileSync(plan.file('checkpoint.md'), 'utf8'), /Revision: 2/);
});

test('missing identifiers and malformed scope cannot create misleading state', context => {
  const plan = session(context);
  assert.throws(() => plan.record({ type: 'added', title: 'Missing task id', acceptance: 'Must reject' }), /Invalid task id/);
  assert.throws(() => plan.record({ type: 'decided', summary: 'Missing decision id', rationale: 'Invalid', source: 'test' }), /Invalid decision id/);
  assert.throws(() => plan.record({ type: 'constructor' }), /Unknown event/);
  assert.throws(() => plan.record({ type: 'scoped', constraints: 'not an array', success: ['Pass tests'] }), /array/);
  add(plan, 'fix');
  finish(plan, 'fix');
  assert.throws(() => plan.record({ type: 'closed', evidence: 'No recorded success criteria' }), /success criteria/);
});