#!/usr/bin/env python3
"""Install canonical skills for hosts without a repository marketplace route."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import sys
import uuid
from pathlib import Path

REPOSITORY = Path(__file__).absolute().parent.parent
NAME = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*\Z")
HOSTS = {
    "opencode": (".agents/skills", ".config/opencode/skills"),
    "antigravity": (".agents/skills", ".gemini/antigravity-cli/skills"),
    "copilot": (".agents/skills", ".copilot/skills"),
    "copilot-vscode": (".github/skills", ".copilot/skills"),
    "gemini-cli": (".agents/skills", ".gemini/skills"),
    "pi": (".agents/skills", ".agents/skills"),
}
MARKETPLACES = {"claude-code", "codex", "cursor"}
LEDGER = ".agent-toolkit-installs.json"


def reject_linked_parents(path: Path) -> None:
    for candidate in (path, *path.parents):
        if candidate.is_symlink() or (hasattr(candidate, "is_junction") and candidate.is_junction()):
            raise ValueError(f"Linked path refused: {candidate}")


def discover_skills(repository: Path = REPOSITORY) -> list[dict]:
    plugins = repository / "plugins"
    reject_linked_parents(plugins)
    skills = []
    names = set()
    for plugin in sorted(plugins.iterdir()):
        if not NAME.fullmatch(plugin.name):
            continue
        source = plugin / "skills"
        reject_linked_parents(source)
        if not source.is_dir():
            continue
        for skill in sorted(source.iterdir()):
            reject_linked_parents(skill)
            if not (skill / "SKILL.md").is_file():
                continue
            if not NAME.fullmatch(skill.name) or skill.name in names:
                raise ValueError(f"Invalid or duplicate skill name: {skill.name}")
            names.add(skill.name)
            skills.append({"plugin": plugin.name, "name": skill.name, "source": skill})
    return skills


def skills_root(host: str, *, scope: str = "user", target: Path | None = None,
                home: Path | None = None, env: dict | None = None) -> Path:
    if host in MARKETPLACES:
        raise ValueError(f"Use the native {host} plugin marketplace; see docs/harnesses.md")
    if host not in HOSTS:
        raise ValueError(f"Unknown host: {host}")
    if scope not in {"project", "user"}:
        raise ValueError(f"Unknown scope: {scope}")
    environment = os.environ if env is None else env
    if target is not None:
        return Path(target).absolute() / HOSTS[host][scope == "user"]
    if scope == "project":
        return Path.cwd() / HOSTS[host][0]
    if host == "opencode" and environment.get("XDG_CONFIG_HOME"):
        return Path(environment["XDG_CONFIG_HOME"]).expanduser().absolute() / "opencode/skills"
    if host == "copilot" and environment.get("COPILOT_CONFIG_DIR"):
        return Path(environment["COPILOT_CONFIG_DIR"]).expanduser().absolute() / "skills"
    return (home or Path.home()) / HOSTS[host][1]


def linked(path: Path) -> bool:
    return path.is_symlink() or (hasattr(path, "is_junction") and path.is_junction())


def present(path: Path) -> bool:
    return path.exists() or linked(path)


def fingerprint(root: Path) -> str:
    digest = hashlib.sha256()

    def walk(path: Path, name: str) -> None:
        if linked(path):
            raise ValueError(f"Skill symlink refused: {path}")
        info = path.stat()
        label = json.dumps(name, ensure_ascii=False, separators=(",", ":"))
        if path.is_dir():
            digest.update(f"directory:{label}\n".encode())
            for child in sorted(path.iterdir()):
                walk(child, f"{name}/{child.name}")
        elif path.is_file():
            digest.update(f"file:{label}:{info.st_size}:{info.st_mode & 0o111}\n".encode())
            digest.update(path.read_bytes())
            digest.update(b"\n")
        else:
            raise ValueError(f"Unsupported skill asset: {path}")

    walk(root, "")
    return digest.hexdigest()


def read_ledger(root: Path) -> dict:
    path = root / LEDGER
    reject_linked_parents(path)
    if not path.exists():
        return {"version": 1, "entries": {}}
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or data.get("version") != 1 or not isinstance(data.get("entries"), dict):
        raise ValueError(f"Invalid install ledger: {path}")
    for name, entry in data["entries"].items():
        if (not NAME.fullmatch(name) or not isinstance(entry, dict)
                or not isinstance(entry.get("plugin"), str) or not NAME.fullmatch(entry["plugin"])
                or any(not isinstance(entry.get(key), str) or not Path(entry[key]).is_absolute()
                       for key in ("repository", "source"))
                or entry.get("mode") not in {"copy", "link"}
                or not isinstance(entry.get("hash"), str) or not re.fullmatch(r"[a-f0-9]{64}", entry["hash"])):
            raise ValueError(f"Invalid install record: {name}")
    return data


def save_ledger(root: Path, ledger: dict) -> None:
    temporary = root / f"{LEDGER}.{uuid.uuid4().hex}.tmp"
    try:
        with temporary.open("x", encoding="utf-8", newline="\n") as stream:
            json.dump(ledger, stream, indent=2)
            stream.write("\n")
        temporary.replace(root / LEDGER)
    finally:
        temporary.unlink(missing_ok=True)


def remove(path: Path) -> None:
    if linked(path):
        if path.is_symlink():
            path.unlink()
        else:
            path.rmdir()
    elif path.is_dir():
        shutil.rmtree(path)
    else:
        path.unlink(missing_ok=True)


def unchanged(destination: Path, entry: dict) -> bool:
    if not present(destination):
        return False
    if entry["mode"] == "link":
        return linked(destination) and destination.resolve() == Path(entry["source"]).resolve()
    return not linked(destination) and destination.is_dir() and fingerprint(destination) == entry["hash"]


def contains(parent: Path, child: Path) -> bool:
    return child == parent or parent in child.parents


def prepare(action: str, *, host: str, plugin: str | None = None, all_plugins: bool = False,
            mode: str = "copy", scope: str = "user", target: Path | None = None,
            repository: Path = REPOSITORY) -> tuple[Path, dict, list[dict]]:
    if action not in {"install", "uninstall", "doctor"}:
        raise ValueError(f"Unknown action: {action}")
    if mode not in {"copy", "link"}:
        raise ValueError(f"Unknown mode: {mode}")
    if plugin is not None and not NAME.fullmatch(plugin):
        raise ValueError(f"Invalid plugin: {plugin}")
    if plugin and all_plugins:
        raise ValueError("Select either --plugin or --all, not both")
    root = skills_root(host, scope=scope, target=target)
    reject_linked_parents(root)
    ledger = read_ledger(root)
    repository = repository.absolute()
    if action == "install":
        selected = [skill for skill in discover_skills(repository) if not plugin or skill["plugin"] == plugin]
        if not selected:
            raise ValueError("No installable skills; MCPs and executable agents require separate setup")
    else:
        selected = [{**entry, "name": name, "source": Path(entry["source"])}
                    for name, entry in ledger["entries"].items()
                    if Path(entry["repository"]) == repository and (not plugin or entry["plugin"] == plugin)]
    plans = []
    for skill in selected:
        destination = root / skill["name"]
        entry = ledger["entries"].get(skill["name"])
        exists = present(destination)
        if contains(skill["source"], destination) or contains(destination, skill["source"]):
            raise ValueError(f"Source and destination overlap: {destination}")
        if entry and Path(entry["repository"]) != repository:
            raise ValueError(f"Another checkout owns {destination}")
        if exists and (not entry or not unchanged(destination, entry)):
            raise ValueError(f"Unmanaged or modified skill refused: {destination}")
        source_hash = fingerprint(skill["source"]) if action == "install" else None
        status = "remove" if action == "uninstall" else ("ok" if exists else "missing")
        if action == "install":
            status = "unchanged" if exists and entry["hash"] == source_hash and entry["mode"] == mode else "install"
        plans.append({**skill, "destination": destination, "hash": source_hash, "status": status})
    return root, ledger, plans


def run(action: str, *, dry_run: bool = False, **options) -> list[dict]:
    root, ledger, plans = prepare(action, **options)
    if dry_run or action == "doctor" or not plans:
        return plans
    root.mkdir(parents=True, exist_ok=True)
    lock = root / ".agent-toolkit-install.lock"
    try:
        with lock.open("x", encoding="ascii") as stream:
            stream.write(f"{os.getpid()}\n")
    except FileExistsError as error:
        raise ValueError(f"Installation locked: {lock}; verify no installer is running before removing a stale lock") from error
    try:
        root, ledger, plans = prepare(action, **options)
        for plan in plans:
            if plan["status"] == "unchanged":
                continue
            destination = plan["destination"]
            if action == "uninstall":
                remove(destination)
                del ledger["entries"][plan["name"]]
                save_ledger(root, ledger)
                continue
            stage = root / f".agent-toolkit-stage-{uuid.uuid4().hex}"
            backup = root / f".agent-toolkit-backup-{uuid.uuid4().hex}"
            installed = False
            backed_up = False
            try:
                if options.get("mode", "copy") == "link":
                    stage.symlink_to(plan["source"], target_is_directory=True)
                else:
                    shutil.copytree(plan["source"], stage)
                if present(destination):
                    destination.rename(backup)
                    backed_up = True
                stage.rename(destination)
                installed = True
                ledger["entries"][plan["name"]] = {
                    "plugin": plan["plugin"], "repository": str(options.get("repository", REPOSITORY).absolute()),
                    "source": str(plan["source"]), "mode": options.get("mode", "copy"), "hash": plan["hash"],
                }
                save_ledger(root, ledger)
            except Exception:
                if installed:
                    remove(destination)
                if backed_up:
                    backup.rename(destination)
                raise
            finally:
                remove(stage)
            remove(backup)
    finally:
        lock.unlink()
    return plans


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("list", "install", "uninstall", "doctor"))
    parser.add_argument("--host", help="Host name or comma-separated host names")
    selection = parser.add_mutually_exclusive_group()
    selection.add_argument("--plugin", help="Canonical plugin directory ID; defaults to all skills")
    selection.add_argument("--all", action="store_true", dest="all_plugins")
    parser.add_argument("--scope", choices=("project", "user"), default="user")
    parser.add_argument("--target", type=Path, help="Replacement project or home root")
    parser.add_argument("--mode", choices=("copy", "link"), default="copy")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)
    if args.action == "list":
        print("Native marketplaces: claude-code, codex, cursor")
        print(f"Script hosts: {', '.join(HOSTS)}")
        for skill in discover_skills():
            print(f"{skill['plugin']}/{skill['name']}")
        return 0
    if not args.host:
        parser.error("--host is required")
    selected_hosts = list(dict.fromkeys(args.host.split(",")))
    options = {key: value for key, value in vars(args).items() if key not in {"action", "host", "dry_run"}}
    try:
        for host in selected_hosts:
            prepare(args.action, host=host, **options)
        unhealthy = False
        for host in selected_hosts:
            plans = run(args.action, host=host, dry_run=args.dry_run, **options)
            for plan in plans:
                prefix = "dry-run " if args.dry_run else ""
                print(f"{prefix}{plan['status']}: {host} {plan['name']} {plan['destination']}")
                unhealthy |= plan["status"] == "missing"
            if not plans:
                print(f"{host}: no owned installations")
        return int(unhealthy)
    except (OSError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())