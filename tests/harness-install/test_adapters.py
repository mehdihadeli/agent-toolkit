import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).absolute().parents[2] / "tools"))

import generate
from adapters.base import parse_markdown


class AdapterTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.base = Path(temporary.name)
        self.repository = self.base / "repo"
        self.plugin = self.repository / "plugins/example"
        (self.plugin / ".claude-plugin").mkdir(parents=True)
        (self.plugin / ".claude-plugin/plugin.json").write_text(json.dumps({"name": "example", "version": "1.0.0", "description": "Example plugin"}), encoding="utf-8")
        self.skill = self.plugin / "skills/check"
        self.skill.mkdir(parents=True)
        (self.skill / "SKILL.md").write_text("---\nname: check\ndescription: |\n  Check examples.\n  Use when reviewing examples.\n---\n\n# Check\n", encoding="utf-8")
        (self.skill / "asset.bin").write_bytes(bytes(range(256)))
        (self.plugin / "agents").mkdir()
        self.agent = self.plugin / "agents/review.md"
        self.agent.write_text('---\nname: review\ndescription: "Review: safely"\ntools: [Read, Grep]\n---\n\nReview code.\n', encoding="utf-8")
        (self.plugin / "commands").mkdir()
        (self.plugin / "commands/verify.md").write_text('---\ndescription: "Check: examples"\n---\n\nCheck $ARGUMENTS.\n', encoding="utf-8")

    def emit(self, harness, **options):
        return generate.generate(self.repository, self.base / "out", harness, **options)

    def test_all_harnesses_preserve_assets_and_validate_deterministically(self):
        for harness in generate.ADAPTERS:
            root = self.emit(harness)
            manifest = generate.read_generated(root, self.repository, harness)
            self.assertTrue(manifest["artifacts"])
            asset = next(root.rglob("asset.bin"))
            self.assertEqual(asset.read_bytes(), bytes(range(256)))
            before = (root / generate.MANIFEST).read_bytes()
            self.emit(harness, check=True)
            self.assertEqual(before, (root / generate.MANIFEST).read_bytes())

    def test_opencode_uses_closed_permission_block_and_native_names(self):
        root = self.emit("opencode")
        fields, body = parse_markdown(root / "agents/example-review.md")
        self.assertEqual(fields["permission"], {"*": "deny", "read": "allow", "grep": "allow"})
        self.assertEqual(fields["mode"], "subagent")
        self.assertNotIn("tools", fields)
        self.assertIn("Review code.", body)
        fields, _ = parse_markdown(root / "skills/example-check/SKILL.md")
        self.assertEqual(fields["name"], "example-check")

    def test_explicit_empty_allowlist_never_becomes_unrestricted(self):
        self.agent.write_text('---\ndescription: Locked\ntools: []\n---\n\nNo tools.\n', encoding="utf-8")
        for harness, path in (("opencode", "agents/example-review.md"), ("copilot", "agents/example-review.agent.md"), ("antigravity", "plugins/example/agents/review.md")):
            root = self.emit(harness)
            fields, _ = parse_markdown(root / path)
            self.assertEqual(fields.get("permission", fields.get("tools")), {"*": "deny"} if harness == "opencode" else [])

    def test_copilot_commands_are_manual_skills_and_tools_are_native(self):
        root = self.emit("copilot")
        fields, _ = parse_markdown(root / "agents/example-review.agent.md")
        self.assertEqual(fields["tools"], ["read", "search"])
        fields, body = parse_markdown(root / "skills/example-verify/SKILL.md")
        self.assertTrue(fields["disable-model-invocation"])
        self.assertNotIn("$ARGUMENTS", body)

    def test_command_skill_name_collisions_are_rejected_before_writes(self):
        (self.plugin / "commands/verify.md").rename(self.plugin / "commands/check.md")
        with self.assertRaisesRegex(ValueError, "collision"):
            self.emit("copilot")

    def test_antigravity_emits_current_plugin_schema_and_command_skill(self):
        root = self.emit("antigravity")
        plugin = root / "plugins/example"
        self.assertEqual(set(json.loads((plugin / "plugin.json").read_text())), {"name", "description"})
        fields, body = parse_markdown(plugin / "skills/verify/SKILL.md")
        self.assertTrue(fields["disable-model-invocation"])
        self.assertNotIn("$ARGUMENTS", body)

    def test_unknown_tools_and_constraints_are_not_silently_discarded(self):
        self.agent.write_text('---\ndescription: Review\ntools: [mcp__server__tool]\n---\nReview.\n', encoding="utf-8")
        for harness in generate.ADAPTERS:
            with self.assertRaisesRegex(ValueError, "Unmapped tools"):
                self.emit(harness)

    def test_unmanaged_or_modified_generated_files_are_preserved(self):
        root = self.emit("opencode")
        path = root / "agents/example-review.md"
        path.write_text("user edit", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "Modified generated"):
            self.emit("opencode")
        self.assertEqual(path.read_text(), "user edit")

    def test_check_detects_source_drift_without_writing(self):
        root = self.emit("opencode")
        before = (root / generate.MANIFEST).read_bytes()
        (self.skill / "new.bin").write_bytes(b"new")
        with self.assertRaisesRegex(ValueError, "source drift"):
            self.emit("opencode", check=True)
        self.assertEqual(before, (root / generate.MANIFEST).read_bytes())

    def test_path_traversal_and_unknown_plugins_are_rejected(self):
        for path in ("../outside", "/absolute", "C:/outside", "skills/../outside", "skills\\outside"):
            with self.assertRaises(ValueError):
                generate.safe_path(path)
        with self.assertRaisesRegex(ValueError, "Unknown plugin"):
            self.emit("opencode", plugin="missing")

    def test_single_plugin_generation_preserves_other_owned_plugins(self):
        other = self.repository / "plugins/neighbor"
        shutil.copytree(self.plugin, other)
        (other / ".claude-plugin/plugin.json").write_text(json.dumps({"name": "neighbor", "version": "1.0.0"}), encoding="utf-8")
        root = self.emit("opencode")
        neighbor = (root / "agents/neighbor-review.md").read_bytes()
        (self.skill / "new.bin").write_bytes(b"new")
        self.emit("opencode", plugin="example")
        self.assertEqual((root / "agents/neighbor-review.md").read_bytes(), neighbor)
        self.assertTrue((root / "skills/example-check/new.bin").exists())
        self.emit("opencode", check=True)

    def test_antigravity_folder_matches_registered_manifest_name(self):
        manifest = self.plugin / ".claude-plugin/plugin.json"
        manifest.write_text(json.dumps({"name": "agent-toolkit-example", "version": "1.0.0"}), encoding="utf-8")
        root = self.emit("antigravity")
        self.assertTrue((root / "plugins/agent-toolkit-example/plugin.json").exists())

    def test_source_models_require_explicit_host_override(self):
        text = self.agent.read_text(encoding="utf-8").replace("tools: [Read, Grep]", "tools: [Read, Grep]\nmodel: opus")
        self.agent.write_text(text, encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "host-specific --model"):
            self.emit("opencode")
        root = self.emit("opencode", model="provider/review-model")
        fields, _ = parse_markdown(root / "agents/example-review.md")
        self.assertEqual(fields["model"], "provider/review-model")


if __name__ == "__main__":
    unittest.main()