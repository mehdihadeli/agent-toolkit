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
6. Check for secrets, overly broad triggers, duplicated instructions, and instructions that conflict with host conventions.
7. Validate frontmatter, directory naming, links, and at least one realistic prompt before publishing.

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

## Validation checklist

- [ ] `SKILL.md` is in a directory named after the skill.
- [ ] Frontmatter contains `name` and meaningful `description`.
- [ ] Description includes concrete trigger guidance.
- [ ] Steps are actionable and ordered.
- [ ] Large supporting material is progressively disclosed.
- [ ] No credentials or secrets are stored in skill files.
- [ ] Skill was exercised with at least one realistic prompt.
