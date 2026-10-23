import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initPlan, readPlan, recordEvents } from '../../../../plugins/planning/skills/durable-plans/scripts/plan.mjs';

const templates = fileURLToPath(new URL('../../../../plugins/planning/skills/durable-plans/templates/', import.meta.url));

for (const name of readdirSync(templates).filter(name => name.endsWith('.json'))) {
  test(`${name} seeds a scoped, dependency-ordered plan without inventing progress`, context => {
    const root = mkdtempSync(join(tmpdir(), 'planning-template-'));
    context.after(() => rmSync(root, { recursive: true, force: true }));
    const events = JSON.parse(readFileSync(join(templates, name), 'utf8'));
    assert.ok(events.every(event => ['scoped', 'added'].includes(event.type)));
    initPlan(root, 'example', `Apply ${name} to the user's approved goal`);
    const state = recordEvents(root, 'example', 1, events);
    assert.ok(state.constraints.length > 0);
    assert.ok(state.success.length > 0);
    assert.ok(Object.keys(state.tasks).length >= 3);
    const seen = new Set();
    for (const [id, task] of Object.entries(state.tasks)) {
      assert.equal(task.status, 'pending');
      assert.equal(task.verification, null);
      assert.ok(task.title.trim() && task.acceptance.trim());
      assert.ok(task.dependsOn.every(dependency => seen.has(dependency)));
      seen.add(id);
    }
    assert.equal(state.closure, null);
    assert.deepEqual(readPlan(root, 'example'), state);
    for (const view of ['checkpoint.md', 'plan.md', 'decisions.md', 'progress.md']) {
      assert.match(readFileSync(join(root, '.plans', 'example', view), 'utf8'), new RegExp(`Revision: ${state.revision}\\b`));
    }
  });
}