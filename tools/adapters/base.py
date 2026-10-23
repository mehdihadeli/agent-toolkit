from __future__ import annotations

import json
import re
from pathlib import Path

import yaml

NAME = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*\Z")


def name(value: str) -> str:
    if not isinstance(value, str) or not NAME.fullmatch(value) or len(value) > 64:
        raise ValueError(f"Invalid or oversized component name: {value}")
    return value


def parse_markdown(path: Path) -> tuple[dict, str]:
    text = path.read_text(encoding="utf-8")
    match = re.match(r"\A---\r?\n(.*?)\r?\n---(?:\r?\n|\Z)", text, re.DOTALL)
    if not match:
        raise ValueError(f"Missing YAML frontmatter: {path}")
    fields = yaml.safe_load(match[1])
    if not isinstance(fields, dict) or not isinstance(fields.get("description"), str) or not fields["description"].strip():
        raise ValueError(f"Missing description: {path}")
    return fields, text[match.end():].lstrip("\r\n")


def markdown(fields: dict, body: str) -> bytes:
    return ("---\n" + yaml.safe_dump(fields, sort_keys=False, allow_unicode=True) + "---\n\n" + body.rstrip() + "\n").encode()


def json_bytes(value: dict) -> bytes:
    return (json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode()


def tools(fields: dict, mapping: dict[str, str]) -> list[str] | None:
    if "tools" not in fields:
        return None
    selected = fields["tools"]
    if isinstance(selected, str):
        selected = [value.strip() for value in selected.split(",") if value.strip()]
    if not isinstance(selected, list) or any(not isinstance(value, str) for value in selected):
        raise ValueError("tools must be a list or comma-separated string")
    unknown = set(selected) - mapping.keys()
    if unknown:
        raise ValueError(f"Unmapped tools refused: {', '.join(sorted(unknown))}")
    return list(dict.fromkeys(mapping[value] for value in selected))


def agent_fields(fields: dict, mapping: dict[str, str], model: str | None) -> dict:
    unsupported = set(fields) - {"name", "description", "tools", "model"}
    if unsupported:
        raise ValueError(f"Unsupported agent fields require explicit porting: {sorted(unsupported)}")
    result = {"description": fields["description"]}
    selected = tools(fields, mapping)
    if selected is not None:
        result["tools"] = selected
    source_model = fields.get("model", "inherit")
    if model:
        result["model"] = model
    elif source_model not in (None, "inherit"):
        raise ValueError(f"Model {source_model!r} requires a host-specific --model override")
    return result


def standalone(body: str) -> None:
    if "${CLAUDE_PLUGIN_ROOT}" in body or re.search(r"\]\((?![a-z]+:|#|/)[^)]+\)", body, re.IGNORECASE):
        raise ValueError("Agents and commands must be standalone; move relative assets into a skill before porting")


def command_fields(fields: dict) -> dict:
    unsupported = set(fields) - {"name", "description", "argument-hint"}
    if unsupported:
        raise ValueError(f"Unsupported command fields require explicit porting: {sorted(unsupported)}")
    return {"description": fields["description"]}