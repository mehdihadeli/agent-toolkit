---
name: vault-management
description: Use this skill when the user wants to add, search, organize, or update software-engineering notes in Obsidian through the Local REST API.
version: 1.0.0
---

# Obsidian Vault Management

Manage a software-engineering knowledge vault in Obsidian without direct filesystem edits.

## When To Use

Use this skill when:

- The user wants to document engineering decisions in Obsidian
- The user asks to create or update notes about `.NET`, AI, Docker, Kubernetes, architecture, or related topics
- The user wants to search prior engineering notes
- The user wants a structured workspace for technical concepts and technologies

## Workspace Shape

The default workspace root is `software-engineering/` with domains such as:

- `technologies/dotnet`
- `technologies/ai`
- `technologies/docker`
- `technologies/kubernetes`
- `concepts/software-architecture`
- `concepts/distributed-systems`
- `concepts/testing`
- `patterns`
- `project-notes`
- `references`
- `journal`
- `inbox`

## Frontmatter Standard

All notes should use this shape:

```yaml
---
title: "Note Title"
description: "Brief summary"
domain: "technologies/dotnet"
tags: ["dotnet", "technology", "software-engineering"]
related: ["[[software-engineering/README]]"]
created: "2026-05-22"
updated: "2026-05-22"
---
```

## Practices

- Prefer storing notes under the configured workspace root
- Keep tags technology-focused and query-friendly
- Use related links to connect architecture, platform, and implementation notes
- Update the `updated` field whenever content changes
- Use `search` before creating a near-duplicate note