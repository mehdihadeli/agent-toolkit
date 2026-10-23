# Create Skill

Repository-local scaffolder for creating a new skill inside an existing Agent Toolkit plugin.

## Commands

```bash
node scripts/forge-skill.mjs create --plugin skill-guide --name example-skill \
  --summary "Describe the skill." \
  --use-for "create an example skill" \
  --do-not-use-for "modify an existing skill" --dry-run

node scripts/forge-skill.mjs --help
node scripts/forge-skill.mjs check create-skill
node scripts/forge-skill.mjs register create-skill --plugin skill-guide \
  --summary "Skill authoring workflow." --dry-run
node scripts/inspect-skill.mjs plugins/skill-guide/skills/example-skill/SKILL.md

# Run from repository root; tests live outside the skill package.
npm --prefix tests/skill-guide test
npm --prefix tests/skill-guide run test:coverage
npm --prefix tests/skill-guide run eval:lint
npm --prefix tests/skill-guide run eval
```

The `--help` option prints the command reference. The `check` command validates
frontmatter and workflow without writing files. All mutating commands are
preview-first: they print a content hash and refuse to write unless the same
inputs are repeated with `--approve <hash>`.
Tests, Vally evaluations, Waza tasks, and marketplace metadata remain
repository-level responsibilities.

The evaluation package's `eval:lint` script validates this skill's Vally
specification. Its `eval` script runs the real-agent evaluation and may require
the provider environment configured by the repository. `npm run test:coverage` runs the deterministic
Node tests with built-in coverage reporting from the root test package:
`npm --prefix tests/skill-guide run test:coverage`.
