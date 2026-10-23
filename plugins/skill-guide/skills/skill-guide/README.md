# Skill Guide

Advisory guidance for designing, authoring, organizing, reviewing, and maintaining agent skills in Agent Toolkit repositories.

## Scope

Use this skill when the task is about:

- deciding whether a capability belongs in a skill;
- defining a skill's trigger description and boundaries;
- designing `SKILL.md` structure and progressive disclosure;
- choosing references, scripts, runtimes, and test locations;
- reviewing an existing skill for clarity, safety, or repository fit;
- validating links, frontmatter, examples, and activation behavior.

Use [create-skill](../create-skill/README.md) instead when the request is to
scaffold a new skill, generate its initial files, register it, or run the
preview-first creation workflow.

This skill is advisory. It does not create files, modify an existing skill, or
run the create-skill generator unless the user explicitly requests a separate
implementation task.

## Skill Contract

Every distributable skill should have a directory whose name matches the
frontmatter `name` value and a required `SKILL.md` file:

```text
plugins/<plugin>/skills/<skill-name>/
├── SKILL.md
├── README.md                 # optional usage and command contract
├── references/               # optional detailed guidance
├── scripts/                  # optional deterministic support code
└── package.json              # only for skill-local tooling
```

The frontmatter must include:

```yaml
---
name: example-skill
description: Describe the capability and concrete situations that should activate it.
---
```

Keep the description specific enough to route requests correctly. State what
the skill does, when it applies, and when another skill or tool owns the task.

## Authoring Workflow

1. Define one capability with a clear user outcome.
2. Identify positive triggers and explicit non-triggers.
3. Describe required inputs, produced outputs, and success criteria.
4. Write the shortest useful workflow in `SKILL.md`.
5. Move detailed examples, policy, and background into `references/`.
6. Add scripts only when deterministic code improves the workflow.
7. Put executable tests under the repository `tests/<plugin>/` tree.
8. Add Vally coverage for observable agent behavior and Waza coverage for trigger routing.
9. Exercise the skill with a realistic prompt before publishing.

## Progressive Disclosure

Keep `SKILL.md` focused on routing and action. Add a separate README when the
skill has a command contract or needs user-facing usage documentation. Add
references when readers need detail that would make activation instructions too
long.

A useful split is:

- `SKILL.md`: activation, boundaries, and ordered workflow;
- `README.md`: commands, examples, setup, and validation;
- `references/`: detailed policies, schemas, and decision rules;
- `scripts/`: deterministic implementation;
- `tests/`: executable tests and prompt evaluations outside the skill package.

Avoid copying the same rules into all files. Link to the owning document and
keep one source of truth for each contract.

## Executable Support

Scripts are optional. Add them when they provide repeatable behavior such as
repository discovery, structured generation, validation, or migration.

Choose the smallest suitable runtime:

- `.mjs` for short-lived Markdown, JSON, YAML, repository, or plugin tooling;
- Python when a domain library materially improves document or image processing;
- C# for MCP servers, standalone agents, Copilot SDK workflows, or substantial
  .NET integrations.

Keep production scripts beside the owning skill or plugin source. Keep tests
outside distributable skill directories:

```text
plugins/<plugin>/skills/<skill-name>/scripts/
tests/<plugin>/skills/<skill-name>/scripts/
```

Do not add a skill-local `package.json` for instruction-only skills. Add one
only when the skill has independently runnable Node tooling or dependencies.

## Safety And Quality

Review every skill for:

- overly broad or vague activation conditions;
- instructions that conflict with host or repository conventions;
- secrets, credentials, unsafe defaults, or unbounded external actions;
- path traversal, accidental overwrites, and ambiguous ownership;
- duplicated guidance that can drift between files;
- examples that do not match the actual command or file layout.

Prefer deterministic, previewable workflows. Make unknowns explicit and stop
when ownership or required inputs are ambiguous.

## Validation Checklist

Before publishing, verify:

- [ ] Directory name matches frontmatter `name`.
- [ ] Frontmatter has a meaningful `description` with concrete triggers.
- [ ] Workflow steps are ordered, actionable, and bounded.
- [ ] Non-trigger cases identify nearby capabilities that own them.
- [ ] References and README links resolve.
- [ ] Scripts use the smallest appropriate runtime.
- [ ] Script tests live under `tests/<plugin>/`.
- [ ] Vally evaluates behavior that users can observe.
- [ ] Waza covers positive and negative trigger cases.
- [ ] A realistic prompt exercises the skill successfully.
- [ ] No credentials or generated build output are included.

## Relationship To Create Skill

`skill-guide` explains how to design and review a skill. `create-skill` performs
the repository-local scaffolding workflow. Keep those responsibilities
separate so an advisory question does not trigger file generation and a
creation request receives deterministic preview and approval handling.

## Local Validation

From the repository root, validate the skill package with the repository's
standard checks:

```text
npm --prefix tests/skill-guide run eval:lint
WAZA_SKILL=skill-guide bash tools/run-waza.sh local
python tools/validate_repository.py
```

Run the broader test package when changing shared skill-guide or create-skill
behavior:

```text
npm --prefix tests/skill-guide test
```
