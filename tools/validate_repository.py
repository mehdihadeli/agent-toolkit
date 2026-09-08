#!/usr/bin/env python3
"""Validate plugin metadata, skills, marketplace entries, and local Markdown links."""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import unquote, urlsplit

MARKDOWN_LINK = re.compile(r"(?<!!)\[[^\]]*\]\(([^)]+)\)")
FRONTMATTER = re.compile(r"\A---\s*\n(.*?)\n---\s*(?:\n|\Z)", re.DOTALL)


@dataclass(frozen=True)
class Finding:
    path: Path
    message: str
    severity: str = "error"

    def render(self, root: Path) -> str:
        try:
            display_path = self.path.relative_to(root)
        except ValueError:
            display_path = self.path
        return f"[{self.severity}] {display_path}: {self.message}"


def read_json(path: Path, findings: list[Finding]) -> dict | None:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        findings.append(Finding(path, f"invalid JSON: {error}"))
        return None
    if not isinstance(value, dict):
        findings.append(Finding(path, "manifest root must be an object"))
        return None
    return value


def resolve_source(root: Path, manifest_path: Path, source: str) -> Path | None:
    if not isinstance(source, str) or not source:
        return None
    if manifest_path == root / ".claude-plugin" / "marketplace.json":
        return (root / source).resolve()
    return (manifest_path.parent / source).resolve()


def validate_marketplace(
    root: Path,
    path: Path,
    expected_manifest_name: str,
    findings: list[Finding],
) -> dict[str, tuple[str, Path]]:
    data = read_json(path, findings)
    entries = data.get("plugins") if data else None
    if not isinstance(entries, list):
        findings.append(Finding(path, "missing plugins array"))
        return {}

    result: dict[str, tuple[str, Path]] = {}
    for entry in entries:
        if not isinstance(entry, dict):
            findings.append(Finding(path, "plugin entry must be an object"))
            continue
        name = entry.get("name")
        version = entry.get("version")
        source = entry.get("source")
        if not all(isinstance(value, str) and value for value in (name, version, source)):
            findings.append(Finding(path, "plugin entry requires non-empty name, version, and source"))
            continue
        plugin_path = resolve_source(root, path, source)
        if plugin_path is None or not plugin_path.is_dir():
            findings.append(Finding(path, f"{name!r} source does not resolve to a plugin directory: {source}"))
            continue
        result[name] = (version, plugin_path)

    if path.name != expected_manifest_name:
        findings.append(Finding(path, f"unexpected marketplace filename; expected {expected_manifest_name}"))
    return result


def parse_frontmatter(path: Path, findings: list[Finding]) -> dict[str, str] | None:
    try:
        content = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as error:
        findings.append(Finding(path, f"cannot read skill: {error}"))
        return None
    match = FRONTMATTER.match(content)
    if not match:
        findings.append(Finding(path, "missing YAML frontmatter"))
        return None
    values: dict[str, str] = {}
    for line in match.group(1).splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        values[key.strip()] = value.strip().strip('"\'')
    for key in ("name", "description"):
        if not values.get(key):
            findings.append(Finding(path, f"frontmatter missing {key}"))
    return values


def validate_plugin_manifests(
    root: Path,
    marketplace_plugins: dict[str, tuple[str, Path]],
    findings: list[Finding],
) -> None:
    plugins_dir = root / "plugins"
    known_paths = {path.resolve(): (name, version) for name, (version, path) in marketplace_plugins.items()}
    for plugin_path in sorted(path for path in plugins_dir.iterdir() if path.is_dir()):
        manifests = [
            plugin_path / ".claude-plugin" / "plugin.json",
            plugin_path / ".codex-plugin" / "plugin.json",
        ]
        local_values: dict[str, str] = {}
        for manifest_path in manifests:
            if not manifest_path.is_file():
                findings.append(Finding(manifest_path, "missing per-plugin manifest"))
                continue
            data = read_json(manifest_path, findings)
            if data is None:
                continue
            name = data.get("name")
            version = data.get("version")
            if not isinstance(name, str) or not name:
                findings.append(Finding(manifest_path, "missing non-empty name"))
            if not isinstance(version, str) or not version:
                findings.append(Finding(manifest_path, "missing non-empty version"))
            if isinstance(name, str) and isinstance(version, str):
                local_values[manifest_path.parent.parent.name] = f"{name}\n{version}"
                marketplace_value = known_paths.get(plugin_path.resolve())
                if marketplace_value is None:
                    findings.append(Finding(manifest_path, "plugin is not registered in marketplace"))
                elif (name, version) != (marketplace_value[0], marketplace_value[1]):
                    findings.append(Finding(manifest_path, "name/version differs from marketplace registration"))

        if len(set(local_values.values())) > 1:
            findings.append(Finding(plugin_path, "Claude and Codex manifests disagree on name/version"))

        skills_dir = plugin_path / "skills"
        if skills_dir.is_dir():
            for skill_dir in sorted(path for path in skills_dir.iterdir() if path.is_dir()):
                skill_path = skill_dir / "SKILL.md"
                if not skill_path.is_file():
                    findings.append(Finding(skill_path, "skill directory is missing SKILL.md"))
                    continue
                frontmatter = parse_frontmatter(skill_path, findings)
                if frontmatter and frontmatter.get("name") != skill_dir.name:
                    findings.append(Finding(skill_path, "frontmatter name must match skill directory"))


def validate_markdown_links(root: Path, findings: list[Finding]) -> None:
    markdown_files = [root / "README.md", root / "AGENTS.md", root / "ARCHITECTURE.md"]
    markdown_files.extend((root / "docs").rglob("*.md"))
    markdown_files.extend((root / "plugins").rglob("*.md"))
    markdown_files.extend((root / "tests").rglob("*.md"))
    for markdown_path in sorted(set(path for path in markdown_files if path.is_file())):
        try:
            content = markdown_path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as error:
            findings.append(Finding(markdown_path, f"cannot read Markdown: {error}"))
            continue
        for raw_target in MARKDOWN_LINK.findall(content):
            target = raw_target.strip().strip("<>").split("#", 1)[0].split("?", 1)[0]
            if not target or "://" in target or target.startswith(("mailto:", "data:")):
                continue
            target_path = (markdown_path.parent / unquote(target)).resolve()
            if not target_path.exists():
                findings.append(Finding(markdown_path, f"dead local link: {raw_target}"))


def validate(root: Path) -> list[Finding]:
    findings: list[Finding] = []
    claude = validate_marketplace(
        root,
        root / ".claude-plugin" / "marketplace.json",
        "marketplace.json",
        findings,
    )
    codex = validate_marketplace(
        root,
        root / ".agents" / "plugins" / "marketplace.json",
        "marketplace.json",
        findings,
    )
    if set(claude) != set(codex):
        findings.append(Finding(root, "Claude and Codex marketplaces register different plugin names"))
    for name in sorted(set(claude) & set(codex)):
        if claude[name][0] != codex[name][0]:
            findings.append(Finding(root, f"marketplace version differs for plugin {name!r}"))
    validate_plugin_manifests(root, claude, findings)
    validate_markdown_links(root, findings)
    return findings


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--strict", action="store_true", help="reserved for CI compatibility")
    args = parser.parse_args(argv)
    root = args.root.resolve()
    findings = validate(root)
    for finding in findings:
        print(finding.render(root))
    if findings:
        print(f"Validation failed: {len(findings)} finding(s)")
        return 1
    print("Repository validation passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
