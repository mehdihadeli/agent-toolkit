# Host Harnesses

Canonical plugin source lives under `plugins/`. Host metadata points at that source; it does not duplicate implementation.

| Host           | Registry                           | Per-plugin metadata                            |
| -------------- | ---------------------------------- | ---------------------------------------------- |
| Claude Code    | `.claude-plugin/marketplace.json`  | `plugins/<id>/.claude-plugin/plugin.json`      |
| Codex          | `.agents/plugins/marketplace.json` | `plugins/<id>/.codex-plugin/plugin.json`       |
| GitHub Copilot | workspace instructions and tools   | plugin README plus executable project or skill |

## Host boundaries

- Claude and Codex consume plugin metadata and Markdown skills.
- MCP clients connect to the published Streamable HTTP endpoint.
- Copilot SDK runs the standalone .NET quality agent.
- .NET projects are not started automatically by plugin discovery.

When a host lacks a native surface, document the limitation rather than adding a generated duplicate. Keep manifests, marketplace paths, versions, and plugin names synchronized.
