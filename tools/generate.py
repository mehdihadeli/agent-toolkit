#!/usr/bin/env python3
"""Generate or check owned native artifacts without changing canonical plugins."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path, PurePosixPath

from adapters import antigravity, copilot, opencode
from adapters.base import json_bytes, markdown, name, parse_markdown, standalone
from harness_install import REPOSITORY, fingerprint, present, reject_linked_parents, remove

ADAPTERS = {"opencode": opencode, "copilot": copilot, "antigravity": antigravity}
ROOTS = {"opencode": ".opencode", "copilot": ".copilot", "antigravity": ".antigravity"}
MANIFEST = ".agent-toolkit-generated.json"


def safe_path(value: str) -> Path:
    path = PurePosixPath(value)
    if not value or "\\" in value or ":" in value or path.is_absolute() or any(part in {"..", "."} for part in value.split("/")):
        raise ValueError(f"Unsafe artifact path: {value}")
    return Path(*path.parts)


def projection(repository: Path, harness: str, plugin: str | None = None, model: str | None = None):
    adapter = ADAPTERS[harness]
    files = {}
    artifacts = []
    selected = []

    def add(path, content, plugin_id, mode=0o644):
        safe_path(path)
        if path in files:
            raise ValueError(f"Artifact collision: {path}")
        files[path] = {"content": content, "plugin": plugin_id, "mode": mode}

    plugins = repository / "plugins"
    reject_linked_parents(plugins)
    for source in sorted(plugins.iterdir()):
        if not source.is_dir() or (plugin and source.name != plugin):
            continue
        plugin_id = name(source.name)
        reject_linked_parents(source)
        metadata_path = source / ".claude-plugin/plugin.json"
        reject_linked_parents(metadata_path)
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        selected.append(plugin_id)
        prefix = f"plugins/{name(metadata['name'])}/" if harness == "antigravity" else ""
        before = len(artifacts)
        skills = source / "skills"
        reject_linked_parents(skills)
        for skill in sorted(skills.iterdir()) if skills.is_dir() else []:
            if not (skill / "SKILL.md").is_file():
                continue
            fingerprint(skill)
            fields, body = parse_markdown(skill / "SKILL.md")
            if fields.get("name") != skill.name:
                raise ValueError(f"Skill name must match directory: {skill}")
            identifier = name(skill.name if harness == "antigravity" else f"{plugin_id}-{skill.name}")
            destination = f"{prefix}skills/{identifier}"
            fields["name"] = identifier
            add(f"{destination}/SKILL.md", markdown(fields, body), plugin_id)
            for asset in sorted(skill.rglob("*")):
                if asset.is_file() and asset != skill / "SKILL.md":
                    add(f"{destination}/{asset.relative_to(skill).as_posix()}", asset.read_bytes(), plugin_id, asset.stat().st_mode & 0o777)
            artifacts.append({"name": name(f"skill-{plugin_id}-{skill.name}"), "plugin": plugin_id, "path": destination, "kind": "skill"})
        for kind in ("agents", "commands"):
            directory = source / kind
            reject_linked_parents(directory)
            for document in sorted(directory.glob("*.md")):
                reject_linked_parents(document)
                fields, body = parse_markdown(document)
                standalone(body)
                component = name(document.stem.removesuffix(".agent"))
                identifier = name(component if harness == "antigravity" else f"{plugin_id}-{component}")
                if kind == "agents":
                    path, content = adapter.agent(fields, body, identifier, model)
                else:
                    path, content = adapter.command(fields, body, identifier)
                path = prefix + path
                add(path, content, plugin_id)
                artifact_path = str(PurePosixPath(path).parent) if path.endswith("/SKILL.md") else path
                artifacts.append({"name": name(f"{kind[:-1]}-{plugin_id}-{component}"), "plugin": plugin_id, "path": artifact_path, "kind": kind[:-1]})
        if harness == "antigravity" and len(artifacts) > before:
            add(prefix + "plugin.json", json_bytes({"name": metadata["name"], "description": metadata.get("description", "")}), plugin_id)
            artifacts[before:] = [{"name": name(f"plugin-{plugin_id}"), "plugin": plugin_id, "path": prefix.rstrip("/"), "kind": "plugin"}]
    if plugin and not selected:
        raise ValueError(f"Unknown plugin: {plugin}")
    manifest = {"version": 1, "harness": harness, "repository": str(repository.absolute()), "plugins": selected, "artifacts": sorted(artifacts, key=lambda artifact: artifact["name"]),
                "files": {path: {"sha256": hashlib.sha256(item["content"]).hexdigest(), "plugin": item["plugin"]} for path, item in sorted(files.items())}}
    return files, manifest


def read_generated(root: Path, repository: Path, harness: str) -> dict:
    reject_linked_parents(root)
    manifest = json.loads((root / MANIFEST).read_text(encoding="utf-8"))
    if (not isinstance(manifest, dict) or manifest.get("version") != 1 or manifest.get("harness") != harness
            or manifest.get("repository") != str(repository.absolute()) or not isinstance(manifest.get("files"), dict)
            or not isinstance(manifest.get("artifacts"), list)):
        raise ValueError(f"Invalid or foreign generated manifest: {root}")
    for artifact in manifest["artifacts"]:
        name(artifact["name"])
        name(artifact["plugin"])
        safe_path(artifact["path"])
    actual = set()
    for path in root.rglob("*"):
        reject_linked_parents(path)
        if path.is_file() and path != root / MANIFEST:
            actual.add(path.relative_to(root).as_posix())
    if actual != set(manifest["files"]):
        raise ValueError(f"Generated tree has missing or unmanaged files: {root}")
    for path, record in manifest["files"].items():
        if hashlib.sha256((root / safe_path(path)).read_bytes()).hexdigest() != record["sha256"]:
            raise ValueError(f"Modified generated file refused: {root / path}")
    return manifest


def generate(repository: Path, output: Path, harness: str, *, plugin=None, model=None, check=False):
    files, manifest = projection(repository, harness, plugin, model)
    root = output / ROOTS[harness]
    reject_linked_parents(root)
    if present(root):
        current = read_generated(root, repository, harness)
        if plugin:
            retained = {path: record for path, record in current["files"].items() if record["plugin"] != plugin}
            if retained.keys() & files.keys():
                raise ValueError("Selected plugin collides with another generated plugin")
            for path, record in retained.items():
                source = root / safe_path(path)
                files[path] = {"content": source.read_bytes(), "plugin": record["plugin"], "mode": source.stat().st_mode & 0o777}
            manifest["plugins"] = sorted(set(current["plugins"]) | set(manifest["plugins"]))
            manifest["artifacts"] = sorted([artifact for artifact in current["artifacts"] if artifact["plugin"] != plugin] + manifest["artifacts"], key=lambda artifact: artifact["name"])
            manifest["files"] = dict(sorted({**retained, **manifest["files"]}.items()))
        if current == manifest:
            return root
    elif check:
        raise ValueError(f"Generated tree missing: {root}")
    if check:
        raise ValueError(f"Generated artifacts have source drift: {root}")
    output.mkdir(parents=True, exist_ok=True)
    lock = output / f".agent-toolkit-{harness}.lock"
    with lock.open("x", encoding="ascii") as stream:
        stream.write(str(os.getpid()))
    stage = None
    backup = None
    try:
        if present(root):
            read_generated(root, repository, harness)
        stage = Path(tempfile.mkdtemp(prefix=f".agent-toolkit-{harness}-", dir=output))
        for path, item in files.items():
            destination = stage / safe_path(path)
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(item["content"])
            destination.chmod(item["mode"])
        (stage / MANIFEST).write_bytes(json_bytes(manifest))
        if present(root):
            backup = Path(tempfile.mkdtemp(prefix=f".agent-toolkit-backup-{harness}-", dir=output))
            backup.rmdir()
            root.rename(backup)
        try:
            stage.rename(root)
        except Exception:
            if backup:
                backup.rename(root)
                backup = None
            raise
    finally:
        if stage and stage.exists():
            shutil.rmtree(stage)
        if backup and backup.exists():
            remove(backup)
        lock.unlink()
    return root


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--harness", choices=(*ADAPTERS, "all"), required=True)
    parser.add_argument("--plugin")
    parser.add_argument("--output", type=Path, default=REPOSITORY)
    parser.add_argument("--model", help="Explicit host-native model for Markdown agents")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args(argv)
    try:
        if args.harness == "all" and args.model:
            raise ValueError("Use --model with one harness at a time")
        selected = ADAPTERS if args.harness == "all" else [args.harness]
        for harness in selected:
            print(generate(REPOSITORY, args.output.absolute(), harness, plugin=args.plugin, model=args.model, check=args.check))
        return 0
    except (OSError, ValueError, KeyError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())