import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../../../../");
const script = join(
  root,
  "plugins/skill-guide/skills/create-skill/scripts/forge-skill.mjs",
);

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "agent-toolkit-create-skill-"));
  mkdirSync(join(directory, "plugins/example/skills"), { recursive: true });
  return directory;
}

function run(directory, ...args) {
  return execFileSync(process.execPath, [script, ...args], {
    cwd: directory,
    encoding: "utf8",
  });
}

test("preview is write-free and approval applies the exact plan", () => {
  const directory = fixture();
  try {
    const args = [
      "create",
      "--plugin",
      "example",
      "--name",
      "release-notes",
      "--summary",
      "Create release notes from repository changes.",
      "--use-for",
      "create release notes",
      "--do-not-use-for",
      "write product announcements",
      "--dry-run",
    ];
    const preview = JSON.parse(run(directory, ...args));
    assert.equal(preview.mode, "preview");
    assert.match(preview.hash, /^[a-f0-9]{64}$/);
    assert.deepEqual(preview.files, [
      "plugins/example/skills/release-notes/SKILL.md",
      "plugins/example/skills/release-notes/README.md",
    ]);
    assert.throws(
      () => readFileSync(join(directory, preview.files[0])),
      /ENOENT/,
    );

    const applied = JSON.parse(
      run(directory, ...args.slice(0, -1), "--approve", preview.hash),
    );
    assert.equal(applied.mode, "applied");
    assert.match(
      readFileSync(join(directory, preview.files[0]), "utf8"),
      /name: release-notes/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("existing skill directories are never overwritten", () => {
  const directory = fixture();
  try {
    const target = join(directory, "plugins/example/skills/existing-skill");
    mkdirSync(target, { recursive: true });
    assert.throws(
      () =>
        run(
          directory,
          "create",
          "--plugin",
          "example",
          "--name",
          "existing-skill",
          "--summary",
          "A valid summary.",
          "--use-for",
          "use it",
          "--do-not-use-for",
          "do not use it",
          "--dry-run",
        ),
      /Skill already exists/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
