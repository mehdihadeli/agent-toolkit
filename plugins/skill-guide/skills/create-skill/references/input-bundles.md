# Input Bundles

Fixture mode turns a complete JSON bundle into the same creation plan used by
the command line. The bundle is intentionally small and versioned so tests can
exercise the workflow without prompts or network access.

Required fields:

```json
{
  "version": 1,
  "plugin": "skill-guide",
  "name": "fixture-skill",
  "summary": "Exercise deterministic skill creation.",
  "use-for": "run fixture checks",
  "do-not-use-for": "replace human review"
}
```

Preview first:

```text
node plugins/skill-guide/skills/create-skill/scripts/forge-skill.mjs fixture \
  --input fixture.json --repo-root . --dry-run
```

Apply only the unchanged preview by passing its returned approval digest. A
fixture is still subject to the same path, collision, and content checks as an
interactive request.