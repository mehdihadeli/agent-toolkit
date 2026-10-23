import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as runtime from '../../../../plugins/planning/skills/durable-plans/scripts/plan.mjs';
import { recoverContext } from '../../../../plugins/planning/hooks/context.mjs';
import { seed, expirySource } from '../../vally/fixtures/seed.mjs';
import { check } from '../../vally/graders/check-plan.mjs';

function workspace(context) {
  const root = mkdtempSync(join(tmpdir(), 'plan-grader-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  seed(root);
  return root;
}

test('hook-recovery grader accepts interpreted journal context and rejects stale completion or plan mutation', context => {
  const root = workspace(context);
  const output = recoverContext('SessionStart', { hook_event_name: 'SessionStart', cwd: root }, {
    DURABLE_PLANS_HOOKS: '1', DURABLE_PLANS_PLAN: 'recovery',
  });
  const text = output.hookSpecificOutput.additionalContext;
  const recovered = JSON.parse(text.slice(text.indexOf('\n') + 1));
  const report = {
    plan: recovered.plan, revision: recovered.revision, task: 'boundary', status: 'active',
    next: 'Add equality boundary regression before changing comparison',
  };
  writeFileSync(join(root, 'hook-recovery.json'), JSON.stringify({ ...report, status: 'done' }));
  assert.throws(() => check(root, 'hook-recovery', runtime), /accurate recovery/);
  writeFileSync(join(root, 'hook-recovery.json'), JSON.stringify(report));
  check(root, 'hook-recovery', runtime);
  runtime.refreshPlan(root, 'recovery');
  assert.throws(() => check(root, 'hook-recovery', runtime), /refreshed a projection/);
});

test('behavior graders accept correct recovery and reject unchanged stale state', context => {
  const root = workspace(context);
  assert.throws(() => check(root, 'recovery', runtime), /persisted handoff/);
  runtime.recordEvent(root, 'recovery', 4, { type: 'advanced', task: 'boundary', next: 'Inspect token expiry source and add equality regression' });
  check(root, 'recovery', runtime);
  writeFileSync(join(root, 'compromised.txt'), 'executed pasted instruction');
  assert.throws(() => check(root, 'recovery', runtime), /note was executed/);
});

test('behavior graders accept dependent invalidation and reject claimed completion', context => {
  const root = workspace(context);
  assert.throws(() => check(root, 'reopen', runtime));
  runtime.recordEvent(root, 'reopen', 9, { type: 'reopened', task: 'boundary', reason: 'New equality regression', next: 'Reproduce regression then revalidate dependent workflow' });
  check(root, 'reopen', runtime);
});

test('behavior graders preserve blocked and corrupt plans without mutations', context => {
  const root = workspace(context);
  check(root, 'blocked', runtime);
  check(root, 'damaged', runtime);
  appendFileSync(join(root, '.plans', 'damaged', 'events.jsonl'), '}\n');
  assert.throws(() => check(root, 'damaged', runtime), /unexpected mutation/);
});

test('initialization grader rejects empty plans and accepts scoped task dependencies', context => {
  const root = workspace(context);
  runtime.initPlan(root, 'session', 'Fix expiry; preserve public API');
  assert.throws(() => check(root, 'initialize', runtime), /decomposition/);
  runtime.recordEvents(root, 'session', 1, [
    { type: 'scoped', constraints: ['Preserve public API'], success: ['Boundary tests pass'] },
    { type: 'added', task: 'fix', title: 'Fix expiry', acceptance: 'Boundary tests pass' },
    { type: 'added', task: 'integration', title: 'Check workflow', acceptance: 'Workflow tests pass', dependsOn: ['fix'] },
  ]);
  check(root, 'initialize', runtime);
});

test('decision-retention grader requires the recovered conclusion and preserves history', context => {
  const root = workspace(context);
  writeFileSync(join(root, 'retained-decision.md'), 'Use client clock');
  assert.throws(() => check(root, 'retention', runtime));
  writeFileSync(join(root, 'retained-decision.md'), 'Use server clock; clients can skew expiry checks. Source: approved token contract section 2.');
  check(root, 'retention', runtime);
});

test('continuous-work grader rejects stale code despite recorded completion', context => {
  const root = workspace(context);
  runtime.initPlan(root, 'continuous', 'Fix expiry and preserve public API');
  runtime.recordEvents(root, 'continuous', 1, [
    { type: 'scoped', constraints: ['Preserve public API'], success: ['Boundary test passes'] },
    { type: 'added', task: 'fix', title: 'Fix expiry', acceptance: 'Boundary test passes' },
    { type: 'added', task: 'review', title: 'Review compatibility', acceptance: 'API unchanged', dependsOn: ['fix'] },
    { type: 'started', task: 'fix', next: 'Run baseline' },
    { type: 'decided', decision: 'expiry-boundary', task: 'fix', summary: 'Equality is expired', rationale: 'Exclusive validity boundary', source: 'boundary.test.mjs' },
    { type: 'verified', task: 'fix', passed: false, evidence: 'Baseline equality test fails' },
    { type: 'advanced', task: 'fix', summary: 'Corrected comparison', artifacts: ['expiry.mjs'], next: 'Run focused test' },
    { type: 'verified', task: 'fix', passed: true, evidence: 'node --test boundary.test.mjs; exit 0' },
    { type: 'completed', task: 'fix' },
    { type: 'started', task: 'review', next: 'Review API and tests' },
    { type: 'verified', task: 'review', passed: true, evidence: 'Export signature unchanged; focused check passes' },
    { type: 'completed', task: 'review' },
    { type: 'closed', evidence: 'All success criteria reviewed; boundary passes and API unchanged' },
  ]);
  assert.throws(() => check(root, 'continuous', runtime), /Hidden behavior check/);
  writeFileSync(join(root, 'expiry.mjs'), expirySource.replace('now > expiresAt', 'now >= expiresAt'));
  check(root, 'continuous', runtime);
});