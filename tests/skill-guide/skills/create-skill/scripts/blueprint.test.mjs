import assert from "node:assert/strict";
import test from "node:test";
import { blueprintFiles } from "../../../../../plugins/skill-guide/skills/create-skill/scripts/blueprint.mjs";

test("renderer creates portable skill files", () => {
  const files = blueprintFiles({
    name: "release-notes",
    summary: "Create release notes.",
    useFor: "create release notes",
    doNotUseFor: "write announcements",
    plugin: "example",
  });
  assert.match(files["SKILL.md"], /name: release-notes/);
  assert.match(files["SKILL.md"], /USE FOR:/);
  assert.match(files["README.md"], /tests\/example\/skills\/release-notes/);
});
