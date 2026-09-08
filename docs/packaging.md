# Packaging

The root marketplace points to independent plugin directories. Host formats are generated or maintained natively because Claude Code, Codex, and Copilot use different discovery metadata.

Each .NET plugin has its own `Directory.Packages.props`; the repository root intentionally has no solution or central .NET package file.

## Local execution

Run a plugin project from its plugin directory. MCP servers use Streamable HTTP and default to ports documented in each plugin README.

## Distribution

Publish a plugin MCP as a .NET deployment or Docker image. Keep endpoint overrides and credentials in environment variables. Do not place secrets in marketplace or plugin manifests.
