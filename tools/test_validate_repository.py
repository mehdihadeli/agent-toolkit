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

    def create_repository(self, *, broken_link: bool = False) -> Path:
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
        manifest = {
            "name": "handy-example",
            "version": "0.1.0",
            "description": "Example plugin",
            "skills": "./skills/",
        }
        self.write_json(root, "plugins/example/.claude-plugin/plugin.json", manifest)
        self.write_json(root, "plugins/example/.codex-plugin/plugin.json", manifest)
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
        return root

    def test_current_repository_passes(self) -> None:
        root = Path(__file__).resolve().parent.parent
        self.assertEqual(validate(root), [])

    def test_valid_root_relative_and_manifest_relative_sources_pass(self) -> None:
        self.assertEqual(validate(self.create_repository()), [])

    def test_dead_local_link_is_reported(self) -> None:
        findings = validate(self.create_repository(broken_link=True))
        self.assertTrue(any("dead local link" in finding.message for finding in findings))


if __name__ == "__main__":
    unittest.main()
