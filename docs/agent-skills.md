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

## Optional executable support

A skill may include deterministic scripts when instructions alone are not enough:

```text
plugins/<plugin>/skills/<skill-name>/
├── SKILL.md
├── references/       # optional supporting material
├── scripts/          # optional production scripts
└── package.json      # only when Node tooling needs its own dependencies

tests/<plugin>/scripts/<skill-name>/  # script tests and fixtures
```

Use `.mjs` by default for skill and plugin-management scripts. Use Python for
domain-specific document or image processing when its libraries are stronger.
Use C# for MCP servers, standalone agents, hosted workflows, Copilot SDK, or
substantial .NET integrations. Keep shared repository tooling in the root
`package.json`; do not add a package file to instruction-only skills.

Script tests belong under `tests/<plugin>/scripts/` and should test the executable
contract directly. Keep them separate from Vally prompt evaluations and Waza
trigger tests.
