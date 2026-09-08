# Agent Skills

Agent skills are reusable Markdown instructions stored inside a plugin:

```text
plugins/<plugin>/skills/<skill-name>/SKILL.md
```

## Required structure

`SKILL.md` starts with YAML frontmatter containing:

```yaml
---
name: example-skill
description: Explain what skill does and when host should activate it.
---
```

The `name` must match its directory name. The `description` must describe concrete activation conditions, not only topic keywords.

## Skill design

Keep core instructions short and deterministic. Put large examples or reference material in nearby `references/` or `assets/` files. A skill should state:

1. Required inputs and context.
2. Ordered work steps.
3. Boundaries and unknowns.
4. Validation criteria.
5. Expected output.

Current examples:

- [docs-research](../plugins/docs-research/skills/docs-research/SKILL.md)
- [skill-guide](../plugins/skill-guide/skills/skill-guide/SKILL.md)

## Evaluation

Add a Vally evaluation under `tests/<plugin>/vally/` for behavior that can be exercised through a prompt. Run `vally lint .` and a focused `vally eval` before publishing.
