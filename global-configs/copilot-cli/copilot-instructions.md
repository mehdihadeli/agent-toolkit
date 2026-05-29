# Copilot CLI & Workspace Instructions

## Shell Enforcement

- Linux/macOS: Use `/bin/bash` only.
- Windows: Use **Git Bash** only. Never generate PowerShell or CMD.

## Plugin Architecture

- Each top-level folder is an independent plugin package.
- Do not move package-specific files to the repository root.
- Tests run via `node --test` in bash.
