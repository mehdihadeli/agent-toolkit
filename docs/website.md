# Documentation Website

The documentation site renders the repository's existing Markdown files with Next.js. Plugin READMEs and guides remain the source of truth; there are no generated content copies to maintain.

## Local Development

From the repository root:

```bash
npm ci
npm run docs:dev
```

Open http://localhost:3000. To use another port:

```bash
npm run docs:dev -- --port 3001
```

## Production Build

```bash
npm run docs:test
npm run docs:build
```

The static site is written to `docs/out/`. To test a GitHub Pages project path locally, set `DOCS_BASE_PATH=/agent-toolkit` before building. The default empty base path supports custom domains and root-level sites.

## Publishing

In the repository's **Settings > Pages**, set **Source** to **GitHub Actions**. The documentation workflow builds on pushes to `main` or manual dispatch, takes the base path from `actions/configure-pages`, and deploys `docs/out/` with the official Pages actions. No personal token is needed.

## Adding Pages

Add an entry to `docs/lib/documents.mjs` with a unique slug, title, and repository-relative Markdown source path. Pages appear in navigation and search automatically. Links between registered Markdown sources become website routes; other repository links open the corresponding source on GitHub.

Raw HTML in Markdown is not executed. Keep documentation content compatible with standard Markdown and GitHub-flavored tables, task lists, and fenced code blocks.