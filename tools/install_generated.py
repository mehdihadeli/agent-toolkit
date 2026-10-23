#!/usr/bin/env python3
"""Install generated native artifacts with ownership and modification checks."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import tempfile
import uuid
from pathlib import Path

from adapters.base import name
from generate import ADAPTERS, ROOTS, generate, read_generated, safe_path
from harness_install import REPOSITORY, contains, fingerprint, linked, present, reject_linked_parents, remove

LEDGER = ".agent-toolkit-native-installs.json"
USER_ROOTS = {"opencode": ".config/opencode", "copilot": ".copilot", "antigravity": ".gemini/antigravity-cli"}
PROJECT_ROOTS = {"opencode": ".opencode", "copilot": ".github"}


def config_root(harness, *, scope="user", target=None, env=None, home=None):
    if harness not in ADAPTERS or scope not in {"project", "user"}:
        raise ValueError("Unknown harness or scope")
    if scope == "project" and harness == "antigravity":
        raise ValueError("Antigravity plugin installation is user-scoped; use agy plugin install for native registration")
    if target is not None:
        return Path(target).absolute() / (PROJECT_ROOTS[harness] if scope == "project" else USER_ROOTS[harness])
    if scope == "project":
        return Path.cwd() / PROJECT_ROOTS[harness]
    environment = os.environ if env is None else env
    if harness == "opencode" and environment.get("XDG_CONFIG_HOME"):
        return Path(environment["XDG_CONFIG_HOME"]).expanduser().absolute() / "opencode"
    variable = {"copilot": "COPILOT_CONFIG_DIR", "antigravity": "ANTIGRAVITY_CONFIG_DIR"}.get(harness)
    if variable and environment.get(variable):
        return Path(environment[variable]).expanduser().absolute()
    return (home or Path.home()) / USER_ROOTS[harness]


def read_ledger(root):
    path = root / LEDGER
    reject_linked_parents(path)
    if not path.exists():
        return {"version": 1, "entries": {}}
    ledger = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(ledger, dict) or ledger.get("version") != 1 or not isinstance(ledger.get("entries"), dict):
        raise ValueError(f"Invalid native install ledger: {path}")
    paths = set()
    for identifier, entry in ledger["entries"].items():
        name(identifier)
        if not isinstance(entry, dict):
            raise ValueError("Invalid native install record")
        name(entry["plugin"])
        relative = safe_path(entry["path"])
        if (relative.as_posix() in paths or entry.get("mode") not in {"copy", "link"}
                or not all(isinstance(entry.get(key), str) and Path(entry[key]).is_absolute() for key in ("repository", "source"))
                or not isinstance(entry.get("hash"), str) or len(entry["hash"]) != 64
                or any(character not in "0123456789abcdef" for character in entry["hash"])):
            raise ValueError("Invalid native install record")
        paths.add(relative.as_posix())
    return ledger


def normalized_link_target(path):
    target = os.path.normcase(os.path.realpath(path))
    if os.name == "nt":
        target = "\\\\" + target[8:] if target.startswith("\\\\?\\unc\\") else target.removeprefix("\\\\?\\")
    return target


def unchanged(destination, entry):
    if not present(destination):
        return False
    if entry["mode"] == "link":
        if not linked(destination):
            return False
        try:
            target = os.readlink(destination)
        except OSError:
            return False
        if not os.path.isabs(target):
            target = os.path.join(destination.parent, target)
        return normalized_link_target(target) == normalized_link_target(entry["source"])
    return not linked(destination) and fingerprint(destination) == entry["hash"]


def prepare(action, *, harness, repository=REPOSITORY, output=None, plugin=None, mode="copy", **options):
    if action not in {"install", "uninstall", "doctor"} or mode not in {"copy", "link"}:
        raise ValueError("Unknown native installer action or mode")
    if plugin:
        name(plugin)
    repository = repository.absolute()
    root = config_root(harness, **options)
    reject_linked_parents(root)
    ledger = read_ledger(root)
    if action == "install":
        generated = (output or repository) / ROOTS[harness]
        manifest = read_generated(generated, repository, harness)
        selected = [{**artifact, "source": str(generated / safe_path(artifact["path"]))}
                    for artifact in manifest["artifacts"] if not plugin or artifact["plugin"] == plugin]
        if not selected:
            raise ValueError("No native Markdown artifacts selected; MCPs and executable agents require separate setup")
    else:
        selected = [{**entry, "name": identifier} for identifier, entry in ledger["entries"].items()
                    if entry["repository"] == str(repository) and (not plugin or entry["plugin"] == plugin)]
    plans = []
    for artifact in selected:
        source = Path(artifact["source"])
        destination = root / safe_path(artifact["path"])
        reject_linked_parents(destination.parent)
        if contains(source, destination) or contains(destination, source):
            raise ValueError(f"Source and destination overlap: {destination}")
        entry = ledger["entries"].get(artifact["name"])
        if entry and (entry["repository"] != str(repository) or entry["path"] != artifact["path"]):
            raise ValueError(f"Foreign install record refused: {destination}")
        if present(destination) and (not entry or not unchanged(destination, entry)):
            raise ValueError(f"Unmanaged or modified artifact refused: {destination}")
        digest = fingerprint(source) if action == "install" else None
        status = "remove" if action == "uninstall" else ("ok" if destination.exists() else "missing")
        if action == "install":
            status = "unchanged" if present(destination) and entry["hash"] == digest and entry["mode"] == mode else "install"
        plans.append({**artifact, "destination": destination, "hash": digest, "status": status})
    return root, ledger, plans


def save(root, ledger):
    temporary = root / f"{LEDGER}.{uuid.uuid4().hex}.tmp"
    try:
        with temporary.open("x", encoding="utf-8", newline="\n") as stream:
            json.dump(ledger, stream, indent=2)
            stream.write("\n")
        temporary.replace(root / LEDGER)
    finally:
        temporary.unlink(missing_ok=True)


def run(action, *, dry_run=False, **options):
    root, ledger, plans = prepare(action, **options)
    if dry_run or action == "doctor" or not plans:
        return plans
    root.mkdir(parents=True, exist_ok=True)
    lock = root / ".agent-toolkit-native-install.lock"
    with lock.open("x", encoding="ascii") as stream:
        stream.write(str(os.getpid()))
    try:
        root, ledger, plans = prepare(action, **options)
        for plan in plans:
            if plan["status"] == "unchanged":
                continue
            destination = plan["destination"]
            destination.parent.mkdir(parents=True, exist_ok=True)
            stage = destination.parent / f".agent-toolkit-stage-{uuid.uuid4().hex}"
            backup = destination.parent / f".agent-toolkit-backup-{uuid.uuid4().hex}"
            existed = present(destination)
            installed = False
            try:
                if action == "install":
                    source = Path(plan["source"])
                    if options.get("mode", "copy") == "link":
                        stage.symlink_to(source, target_is_directory=source.is_dir())
                    elif source.is_dir():
                        shutil.copytree(source, stage)
                    else:
                        shutil.copy2(source, stage)
                if existed:
                    destination.rename(backup)
                if action == "install":
                    stage.rename(destination)
                    installed = True
                    ledger["entries"][plan["name"]] = {"plugin": plan["plugin"], "path": plan["path"],
                        "repository": str(options.get("repository", REPOSITORY).absolute()), "source": plan["source"],
                        "mode": options.get("mode", "copy"), "hash": plan["hash"]}
                else:
                    del ledger["entries"][plan["name"]]
                save(root, ledger)
            except Exception:
                if installed:
                    remove(destination)
                if present(backup):
                    backup.rename(destination)
                raise
            finally:
                remove(stage)
            remove(backup)
    finally:
        lock.unlink()
    return plans


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("install", "uninstall", "doctor"))
    parser.add_argument("--harness", choices=ADAPTERS, required=True)
    parser.add_argument("--plugin")
    parser.add_argument("--scope", choices=("user", "project"), default="user")
    parser.add_argument("--target", type=Path)
    parser.add_argument("--output", type=Path, default=REPOSITORY)
    parser.add_argument("--mode", choices=("copy", "link"), default="copy")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--model")
    args = parser.parse_args(argv)
    try:
        options = {"harness": args.harness, "plugin": args.plugin, "scope": args.scope,
                   "target": args.target, "mode": args.mode, "dry_run": args.dry_run}
        if args.action == "install" and args.dry_run:
            existing = args.output.absolute() / ROOTS[args.harness]
            if present(existing):
                read_generated(existing, REPOSITORY, args.harness)
            with tempfile.TemporaryDirectory(prefix="agent-toolkit-preview-") as directory:
                output = Path(directory)
                generate(REPOSITORY, output, args.harness, model=args.model)
                plans = run(args.action, output=output, **options)
        else:
            if args.action == "install":
                generate(REPOSITORY, args.output.absolute(), args.harness, model=args.model)
            plans = run(args.action, output=args.output.absolute(), **options)
        for plan in plans:
            print(f"{'dry-run ' if args.dry_run else ''}{plan['status']}: {plan['destination']}")
        return int(any(plan["status"] == "missing" for plan in plans))
    except (OSError, ValueError, KeyError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())