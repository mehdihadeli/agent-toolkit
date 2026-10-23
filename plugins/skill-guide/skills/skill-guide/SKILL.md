---
name: skill-guide
description: Explain how to create, organize, and maintain agent skills when the user asks about skill design, structure, authoring, or validation.
---

# Skill Guide

When the user asks about creating, organizing, or maintaining a skill:

1. Explain the required structure:
   - One directory per skill under the host's skills directory.
   - One required `SKILL.md` file with YAML frontmatter.
2. Explain required frontmatter:
   - `name`: short, unique identifier matching the skill directory name.
   - `description`: explicit trigger guidance describing when the skill should be used.
3. Provide a minimal starter template and identify:
   - task scope,
   - expected input and output,
   - success criteria.
4. Recommend progressive disclosure:
   - keep `SKILL.md` concise,
   - place large references, examples, and scripts in separate files.
5. Recommend deterministic workflow steps, explicit tool or source requirements, and clear boundaries for unknowns.
6. When a skill needs executable support, recommend a small `scripts/` directory beside `SKILL.md` and keep the skill instructions focused on the workflow.
7. Recommend `.mjs` for default skill and plugin-management scripts. Use Python when the domain ecosystem is stronger, such as document or image processing, and C# when the capability is a service, MCP server, standalone agent, or substantial .NET integration.
8. Keep script tests outside the skill package under `tests/<plugin>/scripts/`, grouped by skill when needed. Test deterministic script behavior separately from Vally prompt evaluations and Waza trigger evaluations.
9. Use a local `package.json` only when the skill has independently runnable Node tooling or skill-specific dependencies. Keep shared repository tooling in the root package and use `pyproject.toml` or an equivalent Python lock boundary for Python dependencies.
10. Check for secrets, overly broad triggers, duplicated instructions, and instructions that conflict with host conventions.
11. Validate frontmatter, directory naming, links, scripts, and at least one realistic prompt before publishing.

Minimal starter template:

```md
---
name: example-skill
description: Describe what this skill does and when it should be used.
---

# Example Skill

1. Gather required context.
2. Perform task-specific actions.
3. Validate result.

Output:

- Result
- Risks or unknowns
```

## Executable support

Scripts are optional. Add them only when deterministic code makes the skill more useful than instructions alone.

```text
plugins/<plugin>/skills/<skill-name>/
├── SKILL.md
├── README.md                 # optional usage and command contract
├── references/               # optional progressive-disclosure material
├── scripts/                  # optional production scripts
└── package.json              # only for skill-local Node tooling

tests/<plugin>/
├── scripts/<skill-name>/     # script tests and fixtures
├── vally/                    # real agent behavior
└── waza/                     # trigger routing
```

Choose the smallest runtime that fits the job:

- Use `.mjs` by default for short-lived skill tooling, Markdown/JSON/YAML generation, repository discovery, and plugin management.
- Use Python for domain-specific processing when its libraries are materially better, such as PPTX, OOXML, PDF, or image workflows.
- Use C# for MCP servers, standalone agents, Microsoft Agent Framework workflows, Copilot SDK integrations, long-running services, or substantial shared .NET code.
- Do not add a runtime or `package.json` to an instruction-only skill.

Keep production scripts inside the skill or plugin source. Keep tests in `tests/<plugin>/scripts/`; do not place test suites inside distributable skill directories.

## Validation checklist

- [ ] `SKILL.md` is in a directory named after the skill.
- [ ] Frontmatter contains `name` and meaningful `description`.
- [ ] Description includes concrete trigger guidance.
- [ ] Steps are actionable and ordered.
- [ ] Large supporting material is progressively disclosed.
- [ ] Scripts use the smallest suitable runtime and have a documented command contract.
- [ ] Script tests live under `tests/<plugin>/scripts/` and do not rely on prompt evaluation alone.
- [ ] No credentials or secrets are stored in skill files.
- [ ] Skill was exercised with at least one realistic prompt.
