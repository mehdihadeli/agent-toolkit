#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { catalogEntry, updateCatalog } from "./catalog.mjs";
import { blueprintFiles } from "./blueprint.mjs";
import { locateSkillShelf } from "./workbench.mjs";

const NAME_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const VALUE_OPTIONS = new Set([
  "plugin",
  "name",
  "summary",
  "use-for",
  "do-not-use-for",
  "approve",
  "input",
  "repo-root",
]);

function fail(message) {
  throw new Error(message);
}

export function parseArgs(argv) {
  const args = { positionals: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (value === "--help" || value === "-h") {
      args.help = true;
      continue;
    }
    if (value.startsWith("--")) {
      const key = value.slice(2);
      if (!VALUE_OPTIONS.has(key)) fail(`Unknown option: ${value}`);
      const optionValue = argv[index + 1];
      if (!optionValue || optionValue.startsWith("--"))
        fail(`${value} requires a value`);
      args[key] = optionValue;
      index += 1;
      continue;
    }
    args.positionals.push(value);
  }
  return args;
}

function requireName(name) {
  if (!name?.trim() || !NAME_PATTERN.test(name))
    fail("--name must use lowercase-dash form");
}

function requireApproval(args) {
  if (args.dryRun && args.approve)
    fail("Use either --dry-run or --approve, not both");
  if (!args.dryRun && !args.approve)
    fail("Mutating commands require --dry-run first, then --approve <hash>");
}

function displayPath(root, path) {
  return relative(root, path).split(sep).join("/");
}
function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function buildPlan(root, args) {
  for (const field of [
    "plugin",
    "name",
    "summary",
    "use-for",
    "do-not-use-for",
  ])
    if (!args[field]?.trim()) fail(`--${field} is required`);
  requireName(args.name);
  requireApproval(args);
  const target = resolve(locateSkillShelf(root, args.plugin), args.name);
  const expectedRoot = locateSkillShelf(root, args.plugin);
  if (!target.startsWith(`${expectedRoot}${sep}`))
    fail("Skill target escaped plugin skill directory");
  const files = blueprintFiles({
    name: args.name,
    summary: args.summary,
    useFor: args["use-for"],
    doNotUseFor: args["do-not-use-for"],
    plugin: args.plugin,
  });
  const hash = createHash("sha256")
    .update(
      JSON.stringify({
        plugin: args.plugin,
        name: args.name,
        summary: args.summary,
        useFor: args["use-for"],
        doNotUseFor: args["do-not-use-for"],
        files,
      }),
    )
    .digest("hex");
  return { root, target, files, hash };
}

function checkSkill(name) {
  if (name !== "create-skill") fail("check currently supports: create-skill");
  const path = resolve(import.meta.dirname, "..", "SKILL.md");
  const content = readFileSync(path, "utf8");
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatter) fail("SKILL.md is missing YAML frontmatter");
  if (!/^name:\s*create-skill\s*$/m.test(frontmatter[1]))
    fail("frontmatter name does not match the checked skill");
  if (!/^description:\s*.+$/m.test(frontmatter[1]))
    fail("frontmatter description is missing");
  if (!content.includes("## Workflow")) fail("SKILL.md is missing ## Workflow");
  return { ok: true, command: "check", name, path };
}

function applyCreate(root, args) {
  const plan = buildPlan(root, args);
  if (existsSync(plan.target))
    fail(`Skill already exists: ${relative(root, plan.target)}`);
  const files = Object.keys(plan.files).map((file) =>
    displayPath(root, join(plan.target, file)),
  );
  if (args.dryRun) return { mode: "preview", hash: plan.hash, files };
  if (args.approve !== plan.hash)
    fail("Approval hash does not match this exact plan");
  mkdirSync(plan.target, { recursive: false });
  for (const [file, content] of Object.entries(plan.files))
    writeFileSync(join(plan.target, file), content, {
      encoding: "utf8",
      flag: "wx",
    });
  return { mode: "applied", hash: plan.hash, files };
}

function applyRegister(root, args) {
  requireName(args.positionals[1]);
  requireApproval(args);
  if (!args.plugin || !args.summary)
    fail("--plugin and --summary are required");
  const path = resolve(root, "plugins", args.plugin, "README.md");
  const entry = catalogEntry({
    name: args.positionals[1],
    summary: args.summary,
  });
  const content = updateCatalog(path, entry);
  const hash = createHash("sha256").update(content).digest("hex");
  if (args.dryRun)
    return { mode: "preview", hash, files: [displayPath(root, path)] };
  if (args.approve !== hash)
    fail("Approval hash does not match this registration");
  writeFileSync(path, content, { encoding: "utf8", flag: "w" });
  return { mode: "applied", hash, files: [displayPath(root, path)] };
}

function help() {
  process.stdout.write(
    `Usage:\n  forge-skill create --plugin <id> --name <name> --summary <text> --use-for <text> --do-not-use-for <text> --dry-run\n  forge-skill register <name> --plugin <id> --summary <text> --dry-run\n  forge-skill fixture --input <json> --repo-root <path> --dry-run\n  forge-skill check <skill-name>\n`,
  );
}

export function main(argv = process.argv.slice(2), cwd = process.cwd()) {
  const args = parseArgs(argv);
  const command = args.positionals[0];
  if (args.help || command === "help") {
    help();
    return 0;
  }
  if (command === "check") {
    if (args.positionals.length !== 2)
      fail("Usage: forge-skill.mjs check <skill-name>");
    print(checkSkill(args.positionals[1]));
    return 0;
  }
  const root = resolve(args["repo-root"] || cwd);
  if (command === "fixture") {
    if (!args.input) fail("--input is required");
    const fixture = JSON.parse(readFileSync(resolve(root, args.input), "utf8"));
    if (fixture.version && fixture.version !== 1)
      fail("fixture version must be 1");
    return main(
      [
        "create",
        "--plugin",
        fixture.plugin,
        "--name",
        fixture.name,
        "--summary",
        fixture.summary,
        "--use-for",
        fixture["use-for"],
        "--do-not-use-for",
        fixture["do-not-use-for"],
        ...(args.dryRun ? ["--dry-run"] : ["--approve", args.approve]),
      ],
      root,
    );
  }
  if (command === "create") {
    print(applyCreate(root, args));
    return 0;
  }
  if (command === "register") {
    print(applyRegister(root, args));
    return 0;
  }
  fail("Usage requires create, register, fixture, check, or help");
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  try {
    process.exitCode = main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
