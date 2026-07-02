Here's a skill file for the Defuddle package:

```markdown
---
name: defuddle
description: Extract clean markdown content from web pages using Defuddle CLI, removing clutter and navigation to save tokens. Use instead of WebFetch when the user provides a URL to read or analyze, for online documentation, articles, blog posts, or any standard web page. Do NOT use for URLs ending in .md — those are already markdown, use WebFetch directly.
---

# Defuddle

Use Defuddle CLI to extract clean readable content from web pages. Prefer over WebFetch for standard web pages — it removes navigation, ads, and clutter, reducing token usage.

If not installed: `npm install -g defuddle`

## Usage

Always use `--md` for markdown output:

```bash
defuddle parse <url> --md
```

Save to file:

```bash
defuddle parse <url> --md -o content.md
```

Extract specific metadata:

```bash
defuddle parse <url> -p title
defuddle parse <url> -p description
defuddle parse <url> -p domain
```

## Output formats

| Flag | Format |
|------|--------|
| `--md` | Markdown (default choice) |
| `--json` | JSON with both HTML and markdown |
| (none) | HTML |
| `-p <name>` | Specific metadata property |

## Common patterns

Quick extraction to view content:
```bash
defuddle parse <url> --md | head -50
```

Extract title and save content:
```bash
defuddle parse <url> -p title && defuddle parse <url> --md -o article.md
```

Batch processing:
```bash
for url in $(cat urls.txt); do
  defuddle parse "$url" --md -o "$(echo $url | md5sum | cut -d' ' -f1).md"
done
```

## Error handling

- Returns exit code 1 on failure with stderr message
- Empty output may indicate JavaScript-rendered content (use alternative tool)
- Some sites block automated access — respect robots.txt

## Best practices

1. Always prefer `--md` for token efficiency
2. Use `-p title` first to verify page loaded correctly before full extraction
3. Pipe to files for long content to avoid terminal overflow
4. The tool automatically removes: navigation, sidebars, ads, popups, and non-content elements
```

This skill file captures the core functionality of Defuddle — a CLI tool that strips away webpage clutter and outputs clean markdown, which is especially useful for LLM interactions where token efficiency matters. It's designed as a drop-in replacement for WebFetch when dealing with standard web pages.