---
name: docs-research
description: Gather official, up-to-date documentation and convert it into a concise implementation checklist for the current coding task. Use when implementation guidance depends on external library, framework, SDK, API, CLI, or cloud-service documentation.
---

# Documentation Research

When the current coding task depends on external documentation:

1. Identify the exact library, framework, SDK, API, CLI, or cloud service and the version relevant to the repository.
2. Start with official or primary documentation. Use release notes, migration guides, and API references when version differences matter.
3. Capture only task-relevant constraints: supported versions, limits, required fields, authentication, configuration, compatibility, edge cases, and deprecations.
4. Prefer documentation that matches the repository's target version. State when only a newer or older version is documented.
5. Convert findings into a short implementation checklist with concrete commands, configuration changes, or code-level steps.
6. Cite the source for every critical constraint. Include page title and URL when available.
7. Call out unknowns, conflicting sources, and assumptions explicitly. Do not guess undocumented behavior.

## Research tools

Use available research tools in this order:

1. Use an already configured repository MCP such as `agent-toolkit-search` when it provides the needed retrieval capability.
2. Use installed official-documentation tools such as Microsoft Learn or Context7 when they cover the target technology.
3. If a configured local tool is not running, start it using the repository's documented command before falling back to another source.
4. If no suitable tool is available, tell the user which tool would help and provide its installation or configuration steps. Do not install packages, start services, or request credentials without user or environment authorization.

Use primary documentation first. Combine tools when one provides discovery and another provides authoritative source content. Record which tools were used and identify any unavailable or unverified source.

Output format:

## What changed

Summarize relevant recent documentation, version changes, or API differences. Say "No relevant change found" when appropriate.

## What matters for this repo

Relate findings to the repository's target framework, package versions, existing code, and task. Include source citations beside critical claims.

## Implementation checklist

- [ ] Concrete implementation step, command, or code-level change with source citation when needed.
- [ ] Validation step for the documented behavior.

## Risks/unknowns

List unresolved version mismatches, undocumented behavior, conflicting guidance, missing access, or assumptions that need confirmation.
