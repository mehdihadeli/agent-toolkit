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