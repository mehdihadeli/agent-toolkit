import {createHash, randomUUID} from 'node:crypto';
import {cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, renameSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {dirname, isAbsolute, join, relative, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';

export const hosts = {
  'claude-code': {project: '.claude/skills', user: '.claude/skills', env: 'CLAUDE_CONFIG_DIR'},
  codex: {project: '.agents/skills', user: '.agents/skills'},
  'copilot-cli': {project: '.agents/skills', user: '.copilot/skills', env: 'COPILOT_CONFIG_DIR'},
  'copilot-vscode': {project: '.github/skills', user: '.copilot/skills'},
  cursor: {project: '.agents/skills', user: '.cursor/skills'},
  opencode: {project: '.agents/skills', user: '.config/opencode/skills'},
  'gemini-cli': {project: '.agents/skills', user: '.gemini/skills'},
  pi: {project: '.agents/skills', user: '.agents/skills'},
};

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ledgerName = '.agent-toolkit-installs.json';
const validName = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function stat(path) {
  try { return lstatSync(path); } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  }
}

function rejectLinkedParents(path) {
  let current = resolve(path);
  while (true) {
    if (stat(current)?.isSymbolicLink()) throw new Error(`Linked path refused: ${current}`);
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

function contains(parent, child) {
  const suffix = relative(parent, child);
  return suffix === '' || (!suffix.startsWith('..') && !isAbsolute(suffix));
}

export function fingerprint(root) {
  const hash = createHash('sha256');
  function walk(path, name) {
    const info = lstatSync(path);
    if (info.isSymbolicLink()) throw new Error(`Skill symlink refused: ${path}`);
    if (info.isDirectory()) {
      hash.update(`directory:${JSON.stringify(name)}\n`);
      for (const entry of readdirSync(path).sort()) walk(join(path, entry), `${name}/${entry}`);
    } else if (info.isFile()) {
      hash.update(`file:${JSON.stringify(name)}:${info.size}:${info.mode & 0o111}\n`);
      hash.update(readFileSync(path));
      hash.update('\n');
    } else {
      throw new Error(`Unsupported skill asset: ${path}`);
    }
  }
  walk(root, '');
  return hash.digest('hex');
}

export function discoverSkills(repoRoot = repository) {
  const result = [];
  const names = new Set();
  const plugins = join(repoRoot, 'plugins');
  rejectLinkedParents(plugins);
  for (const plugin of readdirSync(plugins).sort()) {
    if (!validName.test(plugin)) continue;
    const skills = join(plugins, plugin, 'skills');
    rejectLinkedParents(skills);
    if (!existsSync(skills)) continue;
    for (const name of readdirSync(skills).sort()) {
      const source = join(skills, name);
      rejectLinkedParents(source);
      if (!existsSync(join(source, 'SKILL.md'))) continue;
      if (!validName.test(name)) throw new Error(`Invalid skill directory: ${name}`);
      if (names.has(name)) throw new Error(`Duplicate skill name: ${name}`);
      names.add(name);
      result.push({plugin, name, source});
    }
  }
  return result;
}

export function skillsRoot(host, {scope = 'project', target, env = process.env, home = homedir(), cwd = process.cwd()} = {}) {
  if (!Object.hasOwn(hosts, host)) throw new Error(`Unknown host: ${host}`);
  if (!['project', 'user'].includes(scope)) throw new Error(`Unknown scope: ${scope}`);
  if (target) return resolve(target, hosts[host][scope]);
  if (scope === 'project') return resolve(cwd, hosts[host].project);
  if (hosts[host].env && env[hosts[host].env]) return resolve(env[hosts[host].env], 'skills');
  if (host === 'opencode' && env.XDG_CONFIG_HOME) return resolve(env.XDG_CONFIG_HOME, 'opencode/skills');
  return resolve(home, hosts[host].user);
}

function readLedger(root) {
  const path = join(root, ledgerName);
  rejectLinkedParents(path);
  if (!existsSync(path)) return {version: 1, entries: {}};
  const data = JSON.parse(readFileSync(path, 'utf8'));
  if (data.version !== 1 || !data.entries || typeof data.entries !== 'object' || Array.isArray(data.entries)) {
    throw new Error(`Invalid install ledger: ${path}`);
  }
  for (const [name, entry] of Object.entries(data.entries)) {
    if (!validName.test(name) || !entry || !validName.test(entry.plugin) ||
        typeof entry.repository !== 'string' || !isAbsolute(entry.repository) ||
        typeof entry.source !== 'string' || !isAbsolute(entry.source) ||
        !['copy', 'link'].includes(entry.mode) || !/^[a-f0-9]{64}$/.test(entry.hash)) {
      throw new Error(`Invalid install record: ${name}`);
    }
  }
  return data;
}

function saveLedger(root, ledger) {
  const temp = join(root, `${ledgerName}.${randomUUID()}.tmp`);
  try {
    writeFileSync(temp, `${JSON.stringify(ledger, null, 2)}\n`, {flag: 'wx'});
    renameSync(temp, join(root, ledgerName));
  } finally {
    rmSync(temp, {force: true});
  }
}

function unchanged(destination, entry) {
  const info = stat(destination);
  if (!info) return false;
  if (entry.mode === 'link') {
    return info.isSymbolicLink() && resolve(dirname(destination), readlinkSync(destination)) === entry.source;
  }
  return !info.isSymbolicLink() && info.isDirectory() && fingerprint(destination) === entry.hash;
}

function execute(action, options = {}) {
  if (!['install', 'uninstall', 'doctor'].includes(action)) throw new Error(`Unknown action: ${action}`);
  const {host, plugin, all = false, dryRun = false, mode = 'copy'} = options;
  if (!['copy', 'link'].includes(mode)) throw new Error(`Unknown mode: ${mode}`);
  if (plugin && !validName.test(plugin)) throw new Error(`Invalid plugin: ${plugin}`);
  if (action !== 'doctor' && Boolean(plugin) === Boolean(all)) throw new Error('Select exactly one: --plugin <id> or --all');
  const repoRoot = resolve(options.repoRoot ?? repository);
  const root = skillsRoot(host, options);
  rejectLinkedParents(root);
  const ledger = readLedger(root);
  const report = [];
  let selected;
  if (action === 'install') {
    const available = discoverSkills(repoRoot);
    selected = available.filter(skill => all || skill.plugin === plugin);
    if (!selected.length) throw new Error(`No installable skills${plugin ? ` in plugin ${plugin}` : ''}; MCPs and executable agents require separate setup`);
  } else {
    selected = Object.entries(ledger.entries)
      .filter(([, entry]) => entry.repository === repoRoot && (!plugin || entry.plugin === plugin))
      .map(([name, entry]) => ({name, ...entry}));
  }
  const plans = selected.map(skill => {
    const destination = join(root, skill.name);
    const entry = Object.hasOwn(ledger.entries, skill.name) ? ledger.entries[skill.name] : undefined;
    const present = stat(destination);
    if (contains(skill.source, destination) || contains(destination, skill.source)) throw new Error(`Source and destination overlap: ${destination}`);
    if (entry && entry.repository !== repoRoot) throw new Error(`Another checkout owns ${destination}`);
    if (present && (!entry || !unchanged(destination, entry))) throw new Error(`Unmanaged or modified skill refused: ${destination}`);
    if (action === 'doctor') return {skill, destination, status: present ? 'ok' : 'missing'};
    if (action === 'uninstall') return {skill, destination, status: 'remove'};
    const hash = fingerprint(skill.source);
    return {skill, destination, hash, status: present && entry.hash === hash && entry.mode === mode ? 'unchanged' : 'install'};
  });
  for (const plan of plans) {
    const {skill, destination, hash, status} = plan;
    report.push({host, skill: skill.name, destination, status, dryRun});
    if (dryRun || action === 'doctor' || status === 'unchanged') continue;
    mkdirSync(root, {recursive: true});
    if (action === 'uninstall') {
      rmSync(destination, {recursive: true, force: true});
      delete ledger.entries[skill.name];
      saveLedger(root, ledger);
      continue;
    }
    const stage = join(root, `.agent-toolkit-stage-${randomUUID()}`);
    const backup = join(root, `.agent-toolkit-backup-${randomUUID()}`);
    let backedUp = false;
    let installed = false;
    try {
      if (mode === 'link') symlinkSync(skill.source, stage, process.platform === 'win32' ? 'junction' : 'dir');
      else cpSync(skill.source, stage, {recursive: true, errorOnExist: true, force: false});
      if (stat(destination)) {
        renameSync(destination, backup);
        backedUp = true;
      }
      renameSync(stage, destination);
      installed = true;
      ledger.entries[skill.name] = {plugin: skill.plugin, repository: repoRoot, source: skill.source, mode, hash};
      saveLedger(root, ledger);
    } catch (error) {
      if (backedUp) {
        rmSync(destination, {recursive: true, force: true});
        renameSync(backup, destination);
      } else if (installed) {
        rmSync(destination, {recursive: true, force: true});
      }
      throw error;
    } finally {
      rmSync(stage, {recursive: true, force: true});
    }
    rmSync(backup, {recursive: true, force: true});
  }
  return report;
}

export function run(action, options = {}) {
  if (action === 'doctor') return execute(action, options);
  const preview = execute(action, {...options, dryRun: true});
  if (options.dryRun || !preview.length) return preview;
  const root = skillsRoot(options.host, options);
  mkdirSync(root, {recursive: true});
  const lock = join(root, '.agent-toolkit-install.lock');
  try {
    writeFileSync(lock, `${process.pid}\n`, {flag: 'wx'});
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`Installation locked: ${lock}; verify no installer is running before removing a stale lock`);
    throw error;
  }
  try {
    return execute(action, options);
  } finally {
    rmSync(lock, {force: true});
  }
}

export function main(args = process.argv.slice(2)) {
  const {values, positionals} = parseArgs({args, allowPositionals: true, options: {
    host: {type: 'string'}, plugin: {type: 'string'}, all: {type: 'boolean'},
    scope: {type: 'string', default: 'project'}, target: {type: 'string'},
    mode: {type: 'string', default: 'copy'}, 'dry-run': {type: 'boolean'}, help: {type: 'boolean'},
  }});
  if (values.help || positionals[0] === 'list') {
    console.log('Usage: node tools/harness-install.mjs <install|uninstall|doctor> --host <host[,host]> [--plugin <id>|--all] [--scope project|user] [--target <project-or-home>] [--mode copy|link] [--dry-run]');
    console.log(`Hosts: ${Object.keys(hosts).join(', ')}`);
    for (const skill of discoverSkills()) console.log(`${skill.plugin}/${skill.name}`);
    console.log('Skills only. Hooks, commands, agent profiles, MCPs, and executable agents are not installed.');
    return;
  }
  if (positionals.length !== 1 || !values.host) throw new Error('Provide one action and --host; use --help for usage');
  const selectedHosts = [...new Set(values.host.split(','))];
  for (const host of selectedHosts) {
    run(positionals[0], {...values, host, dryRun: true});
  }
  let unhealthy = false;
  for (const host of selectedHosts) {
    const reports = run(positionals[0], {...values, host, dryRun: values['dry-run']});
    for (const report of reports) {
      console.log(`${report.dryRun ? 'dry-run ' : ''}${report.status}: ${report.host} ${report.skill} ${report.destination}`);
      if (report.status === 'missing') unhealthy = true;
    }
    if (!reports.length) console.log(`${host}: no owned installations`);
  }
  if (unhealthy) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(); } catch (error) {
    console.error(`error: ${error.message}`);
    process.exitCode = 1;
  }
}