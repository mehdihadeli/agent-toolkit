# 📦 Repomix - Most Useful Commands Cheat Sheet

Repomix is a powerful tool that packs your entire repository into a single, AI-friendly file. Perfect for feeding codebases to LLMs like Claude, ChatGPT, DeepSeek, and more.

## 🚀 Basic Commands

```bash
# Pack current repository (creates repomix-output.xml)
repomix

# Pack a specific directory
repomix path/to/directory

# Pack specific files/directories using glob patterns
repomix --include "src/**/*.ts,**/*.md"

# Exclude specific files/directories
repomix --ignore "**/*.log,tmp/"

# Output to a specific file
repomix -o my-output.xml
```

## 🎨 Output Format Options

```bash
# XML format (default) - Best for Claude/GPT
repomix --style xml

# Markdown format - Human-readable
repomix --style markdown

# JSON format - Programmatic processing
repomix --style json

# Plain text format - Simple and clean
repomix --style plain

# Output to stdout (pipe to other commands)
repomix --stdout | llm "Explain this codebase"
```

## 📊 Token Management

```bash
# Show token count tree (identify large files)
repomix --token-count-tree

# Show only files with 100+ tokens
repomix --token-count-tree 100

# Compress code to reduce tokens (~70% reduction)
repomix --compress

# Show top 10 largest files
repomix --top-files-len 10
```

## 🌐 Remote Repository Processing

```bash
# Pack a GitHub repository
repomix --remote yamadashy/repomix

# Pack specific branch/commit
repomix --remote https://github.com/user/repo/tree/main
repomix --remote user/repo --remote-branch main

# Pack with compression
repomix --remote user/repo --compress
```

## 🔧 Advanced File Selection

```bash
# Include only TypeScript files
repomix --include "**/*.ts"

# Include multiple patterns
repomix --include "src/**/*.{ts,tsx},docs/**/*.md"

# Exclude test files
repomix --ignore "**/*.test.ts,**/*.spec.ts"

# Don't use .gitignore rules
repomix --no-gitignore

# Process files from stdin (great with find/git/fd)
git ls-files "*.ts" | repomix --stdin
find src -name "*.ts" -type f | repomix --stdin
fd -e ts | repomix --stdin
```

## 🎯 Output Control

```bash
# Remove comments from code
repomix --remove-comments

# Remove empty lines
repomix --remove-empty-lines

# Add line numbers to output
repomix --output-show-line-numbers

# Copy output to clipboard
repomix --copy

# Omit file summary section
repomix --no-file-summary

# Omit directory structure
repomix --no-directory-structure

# Generate only metadata (no file contents)
repomix --no-files
```

## 📦 Large Repository Handling

```bash
# Split output into multiple files (1MB chunks)
repomix --split-output 1mb

# Split into 500KB chunks
repomix --split-output 500kb

# Split into 2MB chunks
repomix --split-output 2mb
```

## 🔍 Git Integration

```bash
# Include git commit history (last 50 commits)
repomix --include-logs

# Include specific number of commits
repomix --include-logs --include-logs-count 10

# Include git diffs (working tree + staged changes)
repomix --include-diffs

# Disable git-based file sorting
repomix --no-git-sort-by-changes
```

## 🛡️ Security & Debugging

```bash
# Disable security check (use with caution)
repomix --no-security-check

# Enable verbose logging (see what's happening)
repomix --verbose

# Suppress all output except errors
repomix --quiet
```

## ⚙️ Configuration Management

```bash
# Create default config file
repomix --init

# Create global config (system-wide)
repomix --init --global

# Use custom config file
repomix -c my-config.json

# Use config from home directory
repomix --init --global
```

## 🎓 Practical Examples for AI Workflows

### Example 1: Prepare codebase for Claude analysis
```bash
# Optimal Claude setup with XML format and token count
repomix --style xml --token-count-tree --top-files-len 15
```

### Example 2: Focused code review for specific files
```bash
# Only include src/ but exclude tests
repomix --include "src/**/*.js" --ignore "**/*.test.js"
```

### Example 3: Token-efficient packing
```bash
# Remove comments, empty lines, and compress
repomix --remove-comments --remove-empty-lines --compress
```

### Example 4: Analyze remote repository structure
```bash
# Quick look at a popular repo
repomix --remote facebook/react --no-files --top-files-len 20
```

### Example 5: Large monorepo handling
```bash
# Split into manageable chunks
repomix --split-output 1mb --style markdown
```

### Example 6: Git-aware documentation generation
```bash
# Include history for context
repomix --include-logs --include-diffs --style markdown
```

## 🐳 Docker Usage

```bash
# Run in current directory
docker run -v .:/app -it --rm ghcr.io/yamadashy/repomix

# Process remote repo
docker run -v ./output:/app -it --rm ghcr.io/yamadashy/repomix --remote user/repo
```

## 🎯 MCP Server (AI Integration)

```bash
# Run as MCP server for AI assistants
repomix --mcp
```

## 📝 Configuration File Example

Save as `repomix.config.json` in your project root:

```json
{
  "output": {
    "filePath": "repomix-output.xml",
    "style": "xml",
    "compress": true,
    "removeComments": true,
    "removeEmptyLines": true,
    "topFilesLength": 10,
    "tokenCountTree": true
  },
  "ignore": {
    "useGitignore": true,
    "customPatterns": [
      "**/*.test.ts",
      "**/dist/**",
      ".git",
      ".idea",
      ".vscode"
    ]
  },
  "include": ["src/**/*", "docs/**/*.md"]
}
```

## 💡 Pro Tips

1. **Combine `--stdout` with other tools**: 
   ```bash
   repomix --stdout | pbcopy  # Copy to clipboard (macOS)
   repomix --stdout | wc -l    # Count lines
   ```

2. **Create aliases for frequent tasks**:
   ```bash
   alias repomix-fast='repomix --compress --remove-comments --no-file-summary'
   alias repomix-detail='repomix --token-count-tree --top-files-len 20'
   ```

3. **Use with jq for JSON output**:
   ```bash
   repomix --style json --stdout | jq '.files | keys'
   ```

4. **Quick remote analysis without cloning**:
   ```bash
   repomix --remote user/repo --no-files --token-count-tree
   ```

5. **Save tokens with targeted includes**:
   ```bash
   repomix --include "src/core/**/*.ts" --no-directory-structure
   ```

## 📚 Common Use Cases by AI Tool

| AI Tool | Recommended Command |
|---------|-------------------|
| **Claude** | `repomix --style xml --compress --top-files-len 15` |
| **ChatGPT** | `repomix --style markdown --remove-comments` |
| **DeepSeek** | `repomix --style plain --compress` |
| **GitHub Copilot** | `repomix --style markdown --top-files-len 10` |
| **Code Review** | `repomix --include-diffs --include-logs --style xml` |

---

**Need help?** 
- Official docs: https://github.com/yamadashy/repomix
- Try online: https://repomix.com
- Join Discord: For support and discussion

**Remember:** Always review the output for sensitive information before sharing with AI tools! 🔒
```
