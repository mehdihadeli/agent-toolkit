---
name: create-skill
description: Create and register a complete portable agent skill in this repository with deterministic source files, references, tests, evaluations, and preview-first approval. Use for create-skill, scaffold a skill, register a skill, or create a fixture skill. Do not use for editing one existing skill or creating an MCP, standalone agent, or marketplace plugin.
---

# Create Skill

Create one complete skill and register its repository surfaces without guessing.
The workflow plans first, fails closed on ambiguous conventions, and applies one
approved change set.

## Commands

| Command                                                  | Purpose                                                                       |
| -------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `create-skill <name>`                                    | Create the skill source files from a reviewed proposal.                       |
| `create-skill register <name>`                           | Preview and register an existing complete skill in its plugin README.         |
| `create-skill check <name>`                              | Validate skill metadata and workflow shape without writing.                   |
| `create-skill fixture --input <json> --repo-root <path>` | Deterministically create a validated fixture skill without interview prompts. |

Every mutating command starts with `--dry-run`. Apply the unchanged plan only
after the user approves its single-use hash.

## Command use cases

### `create-skill <name>`

Use when a new capability needs its own skill directory. This creates the
source instructions and README. It does
not create tests or evaluation prompts automatically because those require
human review.

```text
node plugins/skill-guide/skills/create-skill/scripts/forge-skill.mjs create release-notes \
  --plugin skill-guide \
  --summary "Create release notes from repository changes." \
  --use-for "create release notes, summarize changes for a release" \
  --do-not-use-for "write product announcements" \
  --dry-run
```

### `create-skill register <name>`

Use after authoring a complete skill and its tests. The command adds a
human-readable entry to the owning plugin README without changing marketplace
manifests or replacing the skill files.

```text
node plugins/skill-guide/skills/create-skill/scripts/forge-skill.mjs register release-notes \
  --plugin skill-guide --dry-run
```

### `create-skill check <name>`

Use before review or publishing to validate frontmatter, directory/name parity,
the required workflow section. This command is
read-only and does not need an approval hash.

```text
node plugins/skill-guide/skills/create-skill/scripts/forge-skill.mjs check release-notes \
  --plugin skill-guide
```

### `create-skill fixture`

Use in deterministic script tests or CI when a temporary skill must be created
without interview prompts. The JSON input supplies every required field, and
the fixture is written below the repository's `temp/create-skill-fixtures/`
directory only after approval.

```json
{
  "plugin": "skill-guide",
  "name": "fixture-skill",
  "summary": "Exercise skill creation in a test.",
  "use-for": "run fixture skill tests",
  "do-not-use-for": "create production skills"
}
```

```text
node plugins/skill-guide/skills/create-skill/scripts/forge-skill.mjs fixture \
  --input tests/skill-guide/skills/create-skill/scripts/fixture.json \
  --repo-root . --dry-run
```

## Workflow

1. Confirm the target plugin and lowercase-dash skill name.
2. Discover managed configuration or existing repository conventions.
3. Collect a concise summary, concrete activation phrases, and explicit boundaries.
4. Inspect sibling skills and fail if ownership or conventions are ambiguous.
5. Preview the complete change set and show paths plus its approval hash.
6. Apply only the unchanged preview after explicit approval.
7. Run `check`, script tests, Waza, Vally lint, and repository validation.

For this skill package, the short local checks are:

```text
node plugins/skill-guide/skills/create-skill/scripts/forge-skill.mjs --help
node plugins/skill-guide/skills/create-skill/scripts/forge-skill.mjs check create-skill

# Run from repository root; tests live under tests/.
npm --prefix tests/skill-guide test
npm --prefix tests/skill-guide run test:coverage
npm --prefix tests/skill-guide run eval:lint
npm --prefix tests/skill-guide run eval
```

The `check` command validates the current skill without modifying files. The
evaluation package's `eval:lint` script checks the Vally specification, its
`eval` script runs the real-agent evaluation, and the root test package's
`test:coverage` script reports built-in Node test coverage.

## Commands from repository root

```text
node plugins/skill-guide/skills/create-skill/scripts/forge-skill.mjs create release-notes \
  --plugin skill-guide \
  --summary "Create release notes from repository changes." \
  --use-for "create release notes, summarize changes for a release" \
  --do-not-use-for "write product announcements; use the communications workflow" \
  --dry-run

node plugins/skill-guide/skills/create-skill/scripts/forge-skill.mjs check release-notes \
  --plugin skill-guide
```

## Generated boundary

Creation writes `SKILL.md` and `README.md` inside
`plugins/<plugin>/skills/<name>/`. Registration updates the owning plugin
README only. Marketplace manifests register plugins, not individual skills, so
they are not changed by this workflow. Tests and Waza/Vally evaluations remain
under `tests/<plugin>/` and must be authored or reviewed explicitly.

## References

- [Workspace routing](references/workspace-routing.md)
- [Input bundles](references/input-bundles.md)
- [Review gates](references/review-gates.md)

## Safety

- Preview before every write.
- Treat approval hashes as single-use and input-specific.
- Fail when plugin ownership or registration markers are ambiguous.
- Never place credentials in generated files.
- Reject existing destinations and path traversal names.
- Keep production scripts inside the skill and tests under `tests/<plugin>/skills/<name>/`.
