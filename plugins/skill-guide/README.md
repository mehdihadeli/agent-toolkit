# Agent Toolkit Skill Guide Plugin

Reusable agent skill for designing, organizing, authoring, validating, and adding deterministic scripts to agent skills.

## Skill

### `skill-guide`

Use when designing, organizing, authoring, or validating agent skills. It covers required structure and frontmatter, progressive disclosure, deterministic workflows, executable skill scripts, runtime selection, script tests, and a practical validation checklist.

### `create-skill`

Use when scaffolding a new skill inside an existing plugin. The bundled
preview-first Node CLI creates the initial `SKILL.md` and README, prints an
approval hash, and refuses to overwrite an existing skill. Script tests live in
`tests/skill-guide/skills/create-skill/scripts/`; Waza and Vally coverage remain
under that skill's repository-level test folder.

## Evaluation

The skill is evaluated through the repository-level Vally suite:

```bash
VALLY_EVAL_SPEC=tests/skill-guide/skills/skill-guide/vally/eval.yaml mise run vally-eval-copilot-local
```

The evaluation covers skill authoring guidance, validation/safety checks, and
the create-skill workflow. Skill-only plugins use Vally evaluations rather than
.NET unit or integration test projects.

## More information

The skills are documented separately:

- [skill-guide/SKILL.md](skills/skill-guide/SKILL.md)
- [skill-guide/README.md](skills/skill-guide/README.md)
- [create-skill/SKILL.md](skills/create-skill/SKILL.md)
- [create-skill/README.md](skills/create-skill/README.md)
