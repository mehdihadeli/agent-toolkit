import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  locateWorkspace,
  readWorkspaceManifest,
  locateSkillShelf,
} from "../../../../../plugins/skill-guide/skills/create-skill/scripts/workbench.mjs";

test("repository discovery finds nearest managed config", () => {
  const root = mkdtempSync(join(tmpdir(), "create-skill-repo-"));
  try {
    mkdirSync(join(root, "nested"), { recursive: true });
    writeFileSync(join(root, "skills-repo.config.json"), '{"name":"example"}');
    assert.equal(locateWorkspace(join(root, "nested")), root);
    assert.deepEqual(readWorkspaceManifest(root), { name: "example" });
    assert.equal(
      locateSkillShelf(root, "plugin"),
      join(root, "plugins", "plugin", "skills"),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
