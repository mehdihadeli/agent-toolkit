import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../../../../plugins/planning/skills/durable-plans/scripts/plan.mjs', import.meta.url));

test('CLI round trip supports spaced paths, JSON files, stale revisions and refresh', context => {
  const root = mkdtempSync(join(tmpdir(), 'plan cli '));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
  assert.equal(run('init', root, 'demo', 'Preserve user scope').status, 0);
  const eventFile = join(root, 'event draft.json');
  writeFileSync(eventFile, JSON.stringify({ type: 'added', task: 'fix', title: 'Fix boundary', acceptance: 'Focused test passes' }));
  const added = run('record', root, 'demo', '1', `@${eventFile}`);
  assert.equal(added.status, 0, added.stderr);
  assert.match(added.stdout, /Revision: 2/);
  assert.equal(run('record', root, 'demo', '1', `@${eventFile}`).status, 1);
  assert.match(run('status', root, 'demo').stdout, /Fix boundary/);
  rmSync(join(root, '.plans', 'demo', 'checkpoint.md'));
  assert.equal(run('refresh', root, 'demo').status, 0);
  assert.match(run('resume', root, 'demo').stdout, /Ready: fix/);
  assert.match(run('task', root, 'demo', 'fix').stdout, /Focused test passes/);
  writeFileSync(eventFile, JSON.stringify([
    { type: 'scoped', constraints: ['Preserve API'], success: ['Focused test passes'] },
    { type: 'started', task: 'fix', next: 'Run focused test' },
  ]));
  const batch = run('batch', root, 'demo', '2', `@${eventFile}`);
  assert.equal(batch.status, 0, batch.stderr);
  assert.match(batch.stdout, /Revision: 4/);
  assert.equal(run('unknown').status, 1);
  assert.equal(run('record', root, 'demo', '2', '{broken').status, 1);
});