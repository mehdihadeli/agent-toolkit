import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).absolute().parents[2] / "tools"))

import generate
import install_generated as installer


class NativeInstallerTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.base = Path(temporary.name)
        self.repository = self.base / "repo"
        plugin = self.repository / "plugins/example"
        (plugin / ".claude-plugin").mkdir(parents=True)
        (plugin / ".claude-plugin/plugin.json").write_text(json.dumps({"name": "example", "version": "1.0.0"}), encoding="utf-8")
        skill = plugin / "skills/check"
        skill.mkdir(parents=True)
        (skill / "SKILL.md").write_text("---\nname: check\ndescription: Check code\n---\n\nCheck.\n", encoding="utf-8")
        (skill / "asset.bin").write_bytes(bytes(range(256)))
        (plugin / "agents").mkdir()
        (plugin / "agents/review.md").write_text("---\ndescription: Review\ntools: []\n---\n\nReview.\n", encoding="utf-8")
        self.output = self.base / "generated"
        self.target = self.base / "home"
        self.options = {"harness": "opencode", "repository": self.repository, "output": self.output, "target": self.target}

    def generate(self, harness="opencode"):
        return generate.generate(self.repository, self.output, harness)

    def test_all_harnesses_install_repeat_doctor_and_uninstall_without_touching_neighbors(self):
        for harness in generate.ADAPTERS:
            self.generate(harness)
            options = {**self.options, "harness": harness}
            plans = installer.run("install", **options)
            self.assertTrue(all(plan["destination"].exists() for plan in plans))
            self.assertTrue(all(plan["status"] == "unchanged" for plan in installer.run("install", **options)))
            self.assertTrue(all(plan["status"] == "ok" for plan in installer.run("doctor", **options)))
            root = installer.config_root(harness, target=self.target)
            (root / "user-settings.json").write_text("keep", encoding="utf-8")
            installer.run("uninstall", **options)
            self.assertTrue((root / "user-settings.json").exists())
            self.assertTrue(all(not plan["destination"].exists() for plan in plans))

    def test_dry_run_does_not_create_target_directories(self):
        self.generate()
        installer.run("install", dry_run=True, **self.options)
        self.assertFalse(self.target.exists())

    def test_modified_and_unmanaged_artifacts_are_never_overwritten(self):
        self.generate()
        plans = installer.run("install", **self.options)
        document = next(plan["destination"] for plan in plans if plan["destination"].is_file())
        document.write_text("user edit", encoding="utf-8")
        for action in ("install", "uninstall", "doctor"):
            with self.assertRaisesRegex(ValueError, "modified artifact"):
                installer.run(action, **self.options)
        self.assertEqual(document.read_text(), "user edit")

    def test_missing_artifact_reported_and_source_removal_allows_uninstall(self):
        self.generate()
        plans = installer.run("install", **self.options)
        plans[0]["destination"].unlink() if plans[0]["destination"].is_file() else shutil.rmtree(plans[0]["destination"])
        self.assertIn("missing", [plan["status"] for plan in installer.run("doctor", **self.options)])
        shutil.rmtree(self.repository)
        shutil.rmtree(self.output)
        installer.run("uninstall", **self.options)

    def test_foreign_checkout_and_ledger_paths_are_refused(self):
        self.generate()
        installer.run("install", **self.options)
        root = installer.config_root("opencode", target=self.target)
        ledger = json.loads((root / installer.LEDGER).read_text())
        entry = next(iter(ledger["entries"].values()))
        entry["path"] = "../../outside"
        (root / installer.LEDGER).write_text(json.dumps(ledger), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "Unsafe artifact path"):
            installer.run("uninstall", **self.options)

    def test_failed_ledger_save_rolls_back_artifact_replacement(self):
        self.generate()
        plans = installer.run("install", **self.options)
        original = {plan["destination"]: installer.fingerprint(plan["destination"]) for plan in plans}
        source = self.repository / "plugins/example/skills/check/new.bin"
        source.write_bytes(b"new")
        self.generate()
        with patch.object(installer, "save", side_effect=OSError("save failed")):
            with self.assertRaisesRegex(OSError, "save failed"):
                installer.run("install", **self.options)
        for path, digest in original.items():
            self.assertEqual(installer.fingerprint(path), digest)

    def test_roots_honor_overrides_and_project_scope(self):
        self.assertEqual(installer.config_root("opencode", env={"XDG_CONFIG_HOME": str(self.base)}), self.base / "opencode")
        self.assertEqual(installer.config_root("copilot", env={"COPILOT_CONFIG_DIR": str(self.base)}), self.base)
        self.assertEqual(installer.config_root("antigravity", env={"ANTIGRAVITY_CONFIG_DIR": str(self.base)}), self.base)
        self.assertEqual(installer.config_root("copilot", scope="project", target=self.target), self.target / ".github")
        with self.assertRaisesRegex(ValueError, "user-scoped"):
            installer.config_root("antigravity", scope="project")

    def test_link_ownership_normalizes_broken_targets_without_symlink_privileges(self):
        source = self.output / "agents/review.md"
        target = str(source.absolute())
        if sys.platform == "win32":
            target = "\\\\?\\" + target
        entry = {"mode": "link", "source": str(source)}
        destination = self.target / "agents/review.md"
        with patch.object(installer, "present", return_value=True), \
                patch.object(installer, "linked", return_value=True), \
                patch.object(installer.os, "readlink", return_value=target):
            self.assertTrue(installer.unchanged(destination, entry))
            entry["source"] = str(self.output / "agents/other.md")
            self.assertFalse(installer.unchanged(destination, entry))

    def test_broken_owned_links_are_missing_and_can_be_uninstalled(self):
        self.generate()
        try:
            plans = installer.run("install", mode="link", **self.options)
        except OSError as error:
            if getattr(error, "winerror", None) == 1314:
                self.skipTest("Windows symlink privilege unavailable")
            raise
        shutil.rmtree(self.output)
        self.assertTrue(all(plan["status"] == "missing" for plan in installer.run("doctor", **self.options)))
        installer.run("uninstall", **self.options)
        self.assertTrue(all(not installer.present(plan["destination"]) for plan in plans))

    def test_cli_real_planning_plugin_round_trip_and_no_write_preview(self):
        script = Path(__file__).absolute().parents[2] / "tools/install_generated.py"
        output = self.base / "cli-output"
        target = self.base / "cli-home"

        def invoke(action, *extra):
            result = subprocess.run([sys.executable, str(script), action, "--harness", "opencode",
                                     "--plugin", "planning", "--target", str(target), "--output", str(output), *extra],
                                    capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            return result

        invoke("install", "--dry-run")
        self.assertFalse(output.exists())
        self.assertFalse(target.exists())
        invoke("install")
        root = target / ".config/opencode/skills/planning-durable-plans"
        self.assertTrue((root / "scripts/plan.mjs").is_file())
        self.assertIn("unchanged", invoke("install").stdout)
        invoke("doctor")
        invoke("uninstall")
        self.assertFalse(root.exists())


if __name__ == "__main__":
    unittest.main()