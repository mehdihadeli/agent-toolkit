# Contributing to Agent Toolkit

Thanks for contributing to Agent Toolkit. This repository publishes plugins,
MCP servers, agents, and reusable skills for Claude Code, OpenAI Codex, and
GitHub Copilot from one canonical `plugins/` tree.

## Start here

- [AGENTS.md](AGENTS.md): repository structure, boundaries, and quality gates
- [docs/architecture.md](docs/architecture.md): runtime and ownership model
- [docs/plugins.md](docs/plugins.md): plugin layout and host registrations
- [docs/authoring.md](docs/authoring.md): plugin, skill, and MCP authoring rules
- [docs/harnesses.md](docs/harnesses.md): Claude, Codex, Copilot, and MCP boundaries
- [docs/plugin-eval.md](docs/plugin-eval.md): Vally evaluation framework
- [docs/ci.md](docs/ci.md): CI workflows and local equivalents

## Adding or changing a plugin

1. Identify the owning plugin or create `plugins/<id>/` for a new focused capability.
2. Add only applicable surfaces: `agents/`, `commands/`, `skills/`, `mcps/`, and `README.md`.
3. Add `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json` when those hosts are supported.
4. Register new plugins in both root marketplace files:
   `.claude-plugin/marketplace.json` and `.agents/plugins/marketplace.json`.
5. Keep plugin names lowercase, hyphen-separated, and consistent across manifests and registries.
6. Add tests or Vally evaluations under `tests/<id>/`.
7. Update plugin and repository documentation when behavior or public metadata changes.

Each `plugins/<id>/` directory is an independent source-of-truth and release
boundary. Keep executable source inside that directory. Do not duplicate source
under host metadata or commit generated `bin/` and `obj/` output.

## Skills, agents, and MCPs

### Skills

Create skills at `plugins/<id>/skills/<name>/SKILL.md` with valid frontmatter.
Keep activation guidance precise. Put supporting detail beside the skill instead
of making its core instructions unnecessarily large. Add a representative Vally
scenario when the skill has user-visible behavior.

### Agents

Keep agent instructions host-appropriate and explicit about tools, boundaries,
and expected output. If an agent is exposed to more than one host, check each
host's metadata and discovery path. Do not assume that a .NET application starts
automatically through plugin discovery.

### MCP servers

Keep MCP implementation inside `plugins/<id>/mcps/`. Preserve read-only
behavior where required. Bound public URLs, redirects, response sizes,
timeouts, origins, crawl depth, and page counts. Use environment variables for
credentials and endpoint overrides; never place secrets in manifests, fixtures,
workflows, or source code.

When wrapping a third-party API or service, document the dependency and its
configuration in the plugin README. Do not route workspace data through a
contributor-controlled service when a direct, first-party alternative exists.

## Testing and quality gates

Run focused checks first, then broader checks when shared behavior changes.
From the repository root:

```bash
python tools/validate_repository.py
git diff --check
make vally-lint
dotnet test --solution agent-toolkit.slnx
```

For a .NET plugin, also run its focused build and tests. For skill-only changes,
validate frontmatter, referenced paths, Markdown diagnostics, and at least one
realistic Vally prompt. For agent or MCP behavior changes, run the relevant Vally
suite and integration tests.

Run the Copilot-backed evaluation suite with:

```bash
make vally-eval
```

Claude evaluation is optional and requires the local executor, Claude
authentication, and the credentials described in [docs/ci.md](docs/ci.md).

## Cross-harness checklist

- Keep Claude and Codex plugin names and versions aligned.
- Preserve the canonical source under `plugins/`; do not create generated copies.
- Document unsupported host surfaces instead of claiming compatibility.
- Confirm MCP clients connect to the documented endpoint and that standalone
  .NET agents are explicitly started.
- Check Markdown links and host metadata after moving or renaming files.
- Keep examples free of real credentials, private URLs, and machine-specific paths.

## Workflow

1. Open or review an issue describing the problem and proposed scope.
2. Create a focused branch from the default branch.
3. Make the smallest change that satisfies the behavior.
4. Add or update tests, evaluations, and documentation.
5. Run focused checks, then the repository quality gates.
6. Open a pull request describing behavior changes, validation, and any required credentials or services.

Keep unrelated formatting and user changes out of the pull request. Do not
commit secrets, local IDE metadata, generated build output, or changes to
unrelated plugins.

## Review checklist

- [ ] Plugin purpose and ownership are clear.
- [ ] Host manifests and marketplace registrations are synchronized.
- [ ] New behavior has focused tests or Vally evaluations.
- [ ] Public network and credential boundaries remain enforced.
- [ ] Documentation and examples match actual commands and paths.
- [ ] `python tools/validate_repository.py` passes.
- [ ] `vally lint .` passes.
- [ ] Relevant .NET tests pass.
- [ ] `git diff --check` passes.
