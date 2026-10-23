import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  catalogEntry,
  updateCatalog,
} from "../../../../../plugins/skill-guide/skills/create-skill/scripts/catalog.mjs";

test("registration inserts a skill entry once", () => {
  const entry = catalogEntry({
    name: "release-notes",
    summary: "Create release notes.",
  });
  const directory = mkdtempSync(join(tmpdir(), "create-skill-registration-"));
  const path = join(directory, "README.md");
  try {
    const result = updateCatalog(path, entry);
    writeFileSync(path, result);
    assert.match(readFileSync(path, "utf8"), /### `release-notes`/);
    assert.throws(() => updateCatalog(path, entry), /already registered/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
