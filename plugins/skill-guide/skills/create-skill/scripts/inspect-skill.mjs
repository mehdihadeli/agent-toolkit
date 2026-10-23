#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

export function validateSkill(path) {
  const content = readFileSync(resolve(path), "utf8");
  const match = content.match(FRONTMATTER);
  if (!match) throw new Error("SKILL.md is missing YAML frontmatter");
  const name = match[1].match(/^name:\s*(\S+)\s*$/m)?.[1];
  const description = match[1].match(/^description:\s*(.+)$/m)?.[1];
  if (!name || name !== basename(resolve(path, "..")))
    throw new Error("frontmatter name must match the skill directory");
  if (!description || description.length < 20)
    throw new Error("frontmatter description is missing or too short");
  for (const section of ["# ", "## Workflow"]) {
    if (!content.includes(section))
      throw new Error(`SKILL.md is missing ${section.trim()} section`);
  }
  return { ok: true, name, path: resolve(path) };
}

try {
  const path = process.argv[2];
  if (!path) throw new Error("Usage: inspect-skill.mjs <SKILL.md>");
  process.stdout.write(`${JSON.stringify(validateSkill(path), null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
