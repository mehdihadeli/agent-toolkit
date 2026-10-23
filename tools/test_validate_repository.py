import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from validate_repository import validate


class ValidateRepositoryTests(unittest.TestCase):
    def write_json(self, root: Path, relative_path: str, value: dict) -> None:
        path = root / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value), encoding="utf-8")

    def create_repository(self, *, broken_link: bool = False, waza_coverage: bool = True) -> Path:
        root = Path(tempfile.mkdtemp())
        plugin = root / "plugins" / "example"
        (plugin / "skills" / "example-skill").mkdir(parents=True)
        (plugin / "README.md").write_text(
            "[missing](missing.md)" if broken_link else "[architecture](../../ARCHITECTURE.md)",
            encoding="utf-8",
        )
        (root / "ARCHITECTURE.md").write_text("# Architecture\n", encoding="utf-8")
        (plugin / "skills" / "example-skill" / "SKILL.md").write_text(
            "---\nname: example-skill\ndescription: Use when testing validation.\n---\n\n# Skill\n",
            encoding="utf-8",
        )
        if waza_coverage:
            waza = root / "tests" / "example-skill" / "waza"
            (waza / "tasks").mkdir(parents=True)
            (waza / "eval.yaml").write_text(
                "skill: example-skill\nconfig:\n  executor: mock\n",
                encoding="utf-8",
            )
            for task_name in ("positive-trigger-1", "positive-trigger-2", "negative-trigger-1"):
                (waza / "tasks" / f"{task_name}.yaml").write_text("name: test\n", encoding="utf-8")
        manifest = {
            "name": "handy-example",
            "version": "0.1.0",
            "description": "Example plugin",
            "skills": "./skills/",
        }
        self.write_json(root, "plugins/example/.claude-plugin/plugin.json", manifest)
        self.write_json(root, "plugins/example/.codex-plugin/plugin.json", manifest)
        self.write_json(root, "plugins/example/.cursor-plugin/plugin.json", manifest)
        self.write_json(
            root,
            ".claude-plugin/marketplace.json",
            {"plugins": [{"name": "handy-example", "version": "0.1.0", "source": "./plugins/example"}]},
        )
        self.write_json(
            root,
            ".agents/plugins/marketplace.json",
            {"plugins": [{"name": "handy-example", "version": "0.1.0", "source": "../../plugins/example"}]},
        )
        self.write_json(
            root,
            ".cursor-plugin/marketplace.json",
            {"plugins": [{"name": "handy-example", "version": "0.1.0", "source": "./plugins/example"}]},
        )
        return root

    def test_current_repository_passes(self) -> None:
        root = Path(__file__).resolve().parent.parent
        self.assertEqual(validate(root), [])

    def test_valid_root_relative_and_manifest_relative_sources_pass(self) -> None:
        self.assertEqual(validate(self.create_repository()), [])

    def test_dead_local_link_is_reported(self) -> None:
        findings = validate(self.create_repository(broken_link=True))
        self.assertTrue(any("dead local link" in finding.message for finding in findings))

    def test_cursor_marketplace_drift_is_reported(self) -> None:
        root = self.create_repository()
        self.write_json(root, ".cursor-plugin/marketplace.json", {"plugins": []})
        self.assertTrue(any("Claude and Cursor" in finding.message for finding in validate(root)))

    def test_cursor_manifest_drift_is_reported(self) -> None:
        root = self.create_repository()
        self.write_json(root, "plugins/example/.cursor-plugin/plugin.json", {"name": "handy-example", "version": "9.0.0"})
        self.assertTrue(any("manifests disagree" in finding.message for finding in validate(root)))

    def test_missing_waza_coverage_is_reported(self) -> None:
        findings = validate(self.create_repository(waza_coverage=False))
        self.assertTrue(any("missing Waza eval" in finding.message for finding in findings))

    def test_incomplete_waza_coverage_is_reported(self) -> None:
        root = self.create_repository()
        task_dir = root / "tests" / "example-skill" / "waza" / "tasks"
        (task_dir / "positive-trigger-2.yaml").unlink()
        findings = validate(root)
        self.assertTrue(any("two positive" in finding.message for finding in findings))


if __name__ == "__main__":
    unittest.main()
