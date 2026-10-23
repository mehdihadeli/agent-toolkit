import importlib.util
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).absolute().parents[2] / "tools/harness_install.py"
SPEC = importlib.util.spec_from_file_location("harness_install", SCRIPT)
installer = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(installer)


class InstallerTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.base = Path(temporary.name)
        self.repository = self.base / "repo"
        self.source = self.repository / "plugins/example/skills/example-skill"
        (self.source / "scripts").mkdir(parents=True)
        (self.source / "SKILL.md").write_text("---\nname: example-skill\ndescription: Example\n---\n", encoding="utf-8")
        (self.source / "scripts/run.mjs").write_text('console.log("example");\n', encoding="utf-8")
        self.options = {"host": "copilot", "target": self.base / "home", "repository": self.repository}

    def root(self, host="copilot"):
        return installer.skills_root(host, target=self.options["target"])

    def invoke(self, action, *args):
        return subprocess.run([sys.executable, str(SCRIPT), action, "--host", "copilot", "--target",
                               str(self.base / "cli"), *args], capture_output=True, text=True)

    def test_marketplace_hosts_use_native_routes(self):
        for host in ("claude-code", "codex", "cursor"):
            with self.subTest(host=host), self.assertRaisesRegex(ValueError, "native .* marketplace"):
                installer.skills_root(host)

    def test_other_hosts_have_explicit_user_and_project_paths(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for host, (project, user) in installer.HOSTS.items():
                self.assertEqual(installer.skills_root(host, target=root), root / user)
                self.assertEqual(installer.skills_root(host, scope="project", target=root), root / project)

    def test_canonical_skills_discovered(self):
        names = {skill["name"] for skill in installer.discover_skills()}
        self.assertIn("durable-plans", names)
        self.assertIn("docs-research", names)

    def test_every_host_installs_assets_repeats_and_removes_only_owned_skills(self):
        for host in installer.HOSTS:
            with self.subTest(host=host):
                options = {**self.options, "host": host}
                self.assertEqual(installer.run("install", **options)[0]["status"], "install")
                root = self.root(host)
                self.assertTrue((root / "example-skill/scripts/run.mjs").is_file())
                self.assertEqual(installer.run("install", **options)[0]["status"], "unchanged")
                self.assertEqual(installer.run("doctor", **options)[0]["status"], "ok")
                (root / "unrelated.txt").write_text("keep", encoding="utf-8")
                installer.run("uninstall", **options)
                self.assertFalse((root / "example-skill").exists())
                self.assertTrue((root / "unrelated.txt").exists())

    def test_dry_run_leaves_no_directories(self):
        installer.run("install", dry_run=True, **self.options)
        self.assertFalse(self.options["target"].exists())

    def test_modified_and_unmanaged_destinations_are_preserved(self):
        installer.run("install", **self.options)
        destination = self.root() / "example-skill"
        (destination / "SKILL.md").write_text("user edit", encoding="utf-8")
        for action in ("install", "uninstall", "doctor"):
            with self.assertRaisesRegex(ValueError, "modified skill refused"):
                installer.run(action, **self.options)
        shutil.rmtree(destination)
        installer.run("uninstall", **self.options)
        destination.mkdir()
        with self.assertRaisesRegex(ValueError, "Unmanaged"):
            installer.run("install", **self.options)

    def test_source_updates_replace_unchanged_copies(self):
        installer.run("install", **self.options)
        (self.source / "new.bin").write_bytes(bytes(range(256)))
        installer.run("install", **self.options)
        self.assertEqual((self.root() / "example-skill/new.bin").read_bytes(), bytes(range(256)))

    def test_source_removal_does_not_prevent_uninstall(self):
        installer.run("install", **self.options)
        shutil.rmtree(self.repository)
        installer.run("uninstall", **self.options)
        self.assertFalse((self.root() / "example-skill").exists())

    def test_missing_copies_are_reported(self):
        installer.run("install", **self.options)
        shutil.rmtree(self.root() / "example-skill")
        self.assertEqual(installer.run("doctor", **self.options)[0]["status"], "missing")

    def test_install_lock_and_corrupt_ledger_block_writes(self):
        root = self.root()
        root.mkdir(parents=True)
        lock = root / ".agent-toolkit-install.lock"
        lock.write_text("another installer", encoding="ascii")
        with self.assertRaisesRegex(ValueError, "Installation locked"):
            installer.run("install", **self.options)
        self.assertTrue(lock.exists())
        lock.unlink()
        (root / installer.LEDGER).write_text(json.dumps({"version": 1, "entries": {"../escape": {}}}), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "Invalid install record"):
            installer.run("install", **self.options)

    def test_failed_staging_preserves_previous_installation(self):
        installer.run("install", **self.options)
        (self.source / "new.txt").write_text("update", encoding="utf-8")
        with patch.object(installer.shutil, "copytree", side_effect=OSError("staging failure")):
            with self.assertRaisesRegex(OSError, "staging failure"):
                installer.run("install", **self.options)
        self.assertTrue((self.root() / "example-skill/SKILL.md").is_file())
        self.assertEqual(installer.run("doctor", **self.options)[0]["status"], "ok")

    def test_failed_ledger_save_rolls_back_replacement(self):
        installer.run("install", **self.options)
        (self.source / "new.txt").write_text("update", encoding="utf-8")
        with patch.object(installer, "save_ledger", side_effect=OSError("save failure")):
            with self.assertRaisesRegex(OSError, "save failure"):
                installer.run("install", **self.options)
        self.assertFalse((self.root() / "example-skill/new.txt").exists())
        self.assertEqual(installer.run("doctor", **self.options)[0]["status"], "ok")

    def test_foreign_checkout_cannot_replace_installation(self):
        installer.run("install", **self.options)
        other = self.base / "other"
        shutil.copytree(self.repository, other)
        with self.assertRaisesRegex(ValueError, "Another checkout"):
            installer.run("install", **{**self.options, "repository": other})

    def test_nested_symlinks_are_rejected(self):
        outside = self.base / "outside"
        outside.mkdir()
        try:
            (self.source / "external").symlink_to(outside, target_is_directory=True)
        except OSError:
            self.skipTest("Symlink privilege unavailable; default copy mode needs no privilege")
        with self.assertRaisesRegex(ValueError, "symlink refused"):
            installer.run("install", **self.options)

    def test_link_mode_preserves_source_on_uninstall(self):
        try:
            installer.run("install", mode="link", **self.options)
        except OSError as error:
            if getattr(error, "winerror", None) == 1314:
                self.skipTest("Windows symlink privilege unavailable")
            raise
        self.assertTrue((self.root() / "example-skill").is_symlink())
        self.assertEqual(installer.run("install", mode="link", **self.options)[0]["status"], "unchanged")
        installer.run("uninstall", **self.options)
        self.assertTrue((self.source / "SKILL.md").is_file())

    def test_cli_real_skills_round_trip_and_native_host_preflight(self):
        self.assertEqual(self.invoke("install", "--dry-run").returncode, 0)
        self.assertFalse((self.base / "cli").exists())
        self.assertEqual(self.invoke("install").returncode, 0)
        root = installer.skills_root("copilot", target=self.base / "cli")
        self.assertTrue((root / "durable-plans/scripts/plan.mjs").is_file())
        self.assertTrue((root / "create-skill/scripts/forge-skill.mjs").is_file())
        self.assertEqual(self.invoke("doctor").returncode, 0)
        self.assertEqual(self.invoke("uninstall").returncode, 0)
        self.assertEqual(self.invoke("install", "--plugin", "search").returncode, 1)
        result = subprocess.run([sys.executable, str(SCRIPT), "install", "--host", "copilot,cursor",
                                 "--target", str(self.base / "untouched")], capture_output=True, text=True)
        self.assertEqual(result.returncode, 1)
        self.assertFalse((self.base / "untouched").exists())


if __name__ == "__main__":
    unittest.main()