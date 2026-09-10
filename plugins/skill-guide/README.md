# Agent Toolkit Skill Guide Plugin

Reusable agent skill for designing, organizing, authoring, and validating agent skills.

## Skill

### `skill-guide`

Use when designing, organizing, authoring, or validating agent skills. It covers required structure and frontmatter, progressive disclosure, deterministic workflows, and a practical validation checklist.

## Evaluation

The skill is evaluated through the repository-level Vally suite:

```bash
make vally-eval-copilot-local VALLY_EVAL_SPEC=tests/skill-guide/vally/eval.yaml
```

The evaluation covers both skill authoring guidance and validation/safety
checks. Skill-only plugins use Vally evaluations rather than .NET unit or
integration test projects.

## More information

The skill is available at [skills/skill-guide/SKILL.md](skills/skill-guide/SKILL.md).
