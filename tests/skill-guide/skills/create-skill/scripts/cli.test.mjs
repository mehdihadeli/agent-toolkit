import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../../../../");
const script = join(
  root,
  "plugins/skill-guide/skills/create-skill/scripts/forge-skill.mjs",
);

function run(directory, ...args) {
  return JSON.parse(
    execFileSync(process.execPath, [script, ...args], {
      cwd: directory,
      encoding: "utf8",
    }),
  );
}

test("fixture and registration commands produce approved previews", () => {
  const directory = mkdtempSync(
    join(tmpdir(), "agent-toolkit-create-skill-cli-"),
  );
  try {
    mkdirSync(join(directory, "plugins/example/skills/example-skill"), {
      recursive: true,
    });
    writeFileSync(join(directory, "plugins/example/README.md"), "# Example\n");
    writeFileSync(
      join(directory, "fixture.json"),
      JSON.stringify({
        version: 1,
        plugin: "example",
        name: "fixture-skill",
        summary: "Exercise fixture mode.",
        "use-for": "run fixture tests",
        "do-not-use-for": "create production skills",
      }),
    );

    const fixture = run(
      directory,
      "fixture",
      "--input",
      "fixture.json",
      "--repo-root",
      directory,
      "--dry-run",
    );
    assert.equal(fixture.mode, "preview");
    assert.match(fixture.hash, /^[a-f0-9]{64}$/);

    const registration = run(
      directory,
      "register",
      "example-skill",
      "--plugin",
      "example",
      "--summary",
      "An example skill.",
      "--dry-run",
    );
    assert.equal(registration.mode, "preview");
    assert.equal(
      readFileSync(join(directory, "plugins/example/README.md"), "utf8"),
      "# Example\n",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
