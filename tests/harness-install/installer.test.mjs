import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {test} from 'node:test';
import {discoverSkills, hosts, run, skillsRoot} from '../../tools/harness-install.mjs';

function fixture(context) {
  const base = mkdtempSync(join(tmpdir(), 'agent-toolkit-install-'));
  context.after(() => rmSync(base, {recursive: true, force: true}));
  const repoRoot = join(base, 'repo');
  const source = join(repoRoot, 'plugins/example/skills/example-skill');
  mkdirSync(join(source, 'scripts'), {recursive: true});
  writeFileSync(join(source, 'SKILL.md'), '---\nname: example-skill\ndescription: Example\n---\n# Example\n');
  writeFileSync(join(source, 'scripts/run.mjs'), 'console.log("example");\n');
  const options = {repoRoot, target: join(base, 'project'), host: 'claude-code', plugin: 'example'};
  const root = skillsRoot(options.host, options);
  return {base, source, options, root, destination: join(root, 'example-skill')};
}

test('all hosts copy complete skills, repeat safely, and uninstall only owned assets', context => {
  const {options} = fixture(context);
  for (const host of Object.keys(hosts)) {
    const current = {...options, host};
    const root = skillsRoot(host, current);
    assert.equal(run('install', current)[0].status, 'install');
    assert.match(readFileSync(join(root, 'example-skill/scripts/run.mjs'), 'utf8'), /example/);
    assert.equal(run('install', current)[0].status, 'unchanged');
    assert.equal(run('doctor', current)[0].status, 'ok');
    writeFileSync(join(root, 'unrelated.txt'), 'keep');
    run('uninstall', current);
    assert.equal(existsSync(join(root, 'example-skill')), false);
    assert.equal(readFileSync(join(root, 'unrelated.txt'), 'utf8'), 'keep');
  }
});

test('dry run leaves no directories or ledger', context => {
  const {options} = fixture(context);
  assert.equal(run('install', {...options, dryRun: true})[0].status, 'install');
  assert.equal(existsSync(options.target), false);
});

test('modified copies and untracked destinations are never overwritten or deleted', context => {
  const {options, destination} = fixture(context);
  run('install', options);
  writeFileSync(join(destination, 'SKILL.md'), 'user edit');
  for (const action of ['install', 'uninstall', 'doctor']) {
    assert.throws(() => run(action, options), /modified skill refused/);
  }
  assert.equal(readFileSync(join(destination, 'SKILL.md'), 'utf8'), 'user edit');
  rmSync(destination, {recursive: true});
  run('uninstall', options);
  mkdirSync(destination);
  assert.throws(() => run('install', options), /Unmanaged/);
});

test('source updates replace only unchanged owned copies', context => {
  const {options, source, destination} = fixture(context);
  run('install', options);
  writeFileSync(join(source, 'new.txt'), 'new asset');
  assert.equal(run('install', options)[0].status, 'install');
  assert.equal(readFileSync(join(destination, 'new.txt'), 'utf8'), 'new asset');
  writeFileSync(join(destination, 'user.txt'), 'extra');
  assert.throws(() => run('uninstall', options), /modified/);
});

test('uninstall still works after source removal and doctor reports missing copies', context => {
  const {options, source, destination} = fixture(context);
  run('install', options);
  rmSync(source, {recursive: true});
  rmSync(destination, {recursive: true});
  assert.equal(run('doctor', options)[0].status, 'missing');
  assert.equal(run('uninstall', options)[0].status, 'remove');
});

test('linked installation is idempotent and removal preserves source', context => {
  const {options, source, destination} = fixture(context);
  run('install', {...options, mode: 'link'});
  assert.equal(lstatSync(destination).isSymbolicLink(), true);
  assert.equal(run('install', {...options, mode: 'link'})[0].status, 'unchanged');
  run('uninstall', options);
  assert.equal(existsSync(join(source, 'SKILL.md')), true);
});

test('source symlinks and linked destination parents are refused', context => {
  const {options, source, base} = fixture(context);
  const outside = join(base, 'outside');
  mkdirSync(outside);
  symlinkSync(outside, join(source, 'external'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => run('install', options), /symlink refused/);
  rmSync(join(source, 'external'), {recursive: true});
  symlinkSync(outside, options.target, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => run('install', options), /Linked path refused/);
});

test('foreign checkout ownership, path traversal, overlap, and bad selections fail', context => {
  const {options, source, base} = fixture(context);
  run('install', options);
  assert.throws(() => run('install', {...options, plugin: '../example'}), /Invalid plugin/);
  assert.throws(() => run('install', {...options, all: true}), /exactly one/);
  assert.throws(() => run('install', {...options, host: 'unknown'}), /Unknown host/);
  assert.throws(() => run('install', {...options, scope: 'unknown'}), /Unknown scope/);
  assert.throws(() => run('install', {...options, plugin: 'missing'}), /No installable skills/);
  const otherRepo = join(base, 'other');
  mkdirSync(join(otherRepo, 'plugins/example/skills/example-skill'), {recursive: true});
  writeFileSync(join(otherRepo, 'plugins/example/skills/example-skill/SKILL.md'), 'other');
  assert.throws(() => run('install', {...options, repoRoot: otherRepo}), /Another checkout owns/);
  assert.throws(() => run('install', {...options, target: source}), /overlap/);
});

test('host paths honor scopes and host environment overrides', () => {
  const home = resolve('fake-home');
  const settings = {scope: 'user', home, env: {}};
  assert.equal(skillsRoot('codex', settings), join(home, '.agents/skills'));
  assert.equal(skillsRoot('copilot-vscode', settings), join(home, '.copilot/skills'));
  assert.equal(skillsRoot('claude-code', {...settings, env: {CLAUDE_CONFIG_DIR: home}}), join(home, 'skills'));
  assert.equal(skillsRoot('opencode', {...settings, env: {XDG_CONFIG_HOME: home}}), join(home, 'opencode/skills'));
});

test('concurrent installer lock and corrupt ownership records block writes', context => {
  const {options, root, destination} = fixture(context);
  mkdirSync(root, {recursive: true});
  const lock = join(root, '.agent-toolkit-install.lock');
  writeFileSync(lock, 'other installer');
  assert.throws(() => run('install', options), /Installation locked/);
  assert.equal(existsSync(destination), false);
  assert.equal(readFileSync(lock, 'utf8'), 'other installer');
  rmSync(lock);
  writeFileSync(join(root, '.agent-toolkit-installs.json'), JSON.stringify({version: 1, entries: {'../escape': {}}}));
  assert.throws(() => run('install', options), /Invalid install record/);
  assert.equal(existsSync(destination), false);
});

test('switching copy and link mode preserves source and replaces owned artifacts', context => {
  const {options, destination, source} = fixture(context);
  run('install', options);
  run('install', {...options, mode: 'link'});
  assert.equal(lstatSync(destination).isSymbolicLink(), true);
  run('install', options);
  assert.equal(lstatSync(destination).isSymbolicLink(), false);
  assert.equal(existsSync(join(source, 'SKILL.md')), true);
});

test('canonical skills are discoverable and CLI dry-run supports multiple hosts', context => {
  assert.ok(discoverSkills().some(skill => skill.name === 'durable-plans'));
  const {base} = fixture(context);
  const target = join(base, 'cli');
  const output = execFileSync(process.execPath, ['tools/harness-install.mjs', 'install', '--host', 'claude-code,codex,copilot-vscode', '--all', '--target', target, '--dry-run'], {encoding: 'utf8'});
  assert.match(output, /dry-run install: claude-code/);
  assert.match(output, /dry-run install: codex/);
  assert.match(output, /dry-run install: copilot-vscode/);
  assert.equal(existsSync(target), false);
  const invalid = spawnSync(process.execPath, ['tools/harness-install.mjs', 'install', '--host', 'claude-code,unknown', '--all', '--target', target], {encoding: 'utf8'});
  assert.equal(invalid.status, 1);
  assert.equal(existsSync(target), false);
});

test('CLI installs real plugin assets, diagnoses missing skills, and uninstalls', context => {
  const {base} = fixture(context);
  const target = join(base, 'real-install');
  const args = ['--host', 'claude-code,codex,copilot-vscode', '--all', '--target', target];
  const invoke = action => spawnSync(process.execPath, ['tools/harness-install.mjs', action, ...args], {encoding: 'utf8'});
  assert.equal(invoke('install').status, 0);
  for (const host of ['claude-code', 'codex', 'copilot-vscode']) {
    const root = skillsRoot(host, {target});
    assert.equal(existsSync(join(root, 'durable-plans/scripts/plan.mjs')), true);
    assert.equal(existsSync(join(root, 'durable-plans/templates/delivery.json')), true);
    assert.equal(existsSync(join(root, 'create-skill/scripts/forge-skill.mjs')), true);
    assert.equal(existsSync(join(root, 'docs-research/SKILL.md')), true);
  }
  const diagnosis = invoke('doctor');
  assert.equal(diagnosis.status, 0);
  assert.doesNotMatch(diagnosis.stdout, /dry-run/);
  rmSync(join(skillsRoot('codex', {target}), 'durable-plans'), {recursive: true});
  assert.equal(invoke('doctor').status, 1);
  assert.equal(invoke('uninstall').status, 0);
  const noSkills = spawnSync(process.execPath, ['tools/harness-install.mjs', 'install', '--host', 'codex', '--plugin', 'search', '--target', target], {encoding: 'utf8'});
  assert.equal(noSkills.status, 1);
  assert.match(noSkills.stderr, /MCPs and executable agents require separate setup/);
});