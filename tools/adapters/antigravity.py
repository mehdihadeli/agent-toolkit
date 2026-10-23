from .base import agent_fields, command_fields, markdown

TOOLS = {
    "Read": "read_file", "Write": "write_file", "Edit": "replace",
    "Bash": "run_shell_command", "Grep": "grep_search", "Glob": "glob",
    "LS": "list_directory", "WebFetch": "web_fetch", "WebSearch": "google_web_search",
}


def agent(fields, body, identifier, model=None):
    result = {"name": identifier, **agent_fields(fields, TOOLS, model), "subagent": True}
    if result.get("model") not in (None, "inherit", "flash", "pro"):
        raise ValueError("Antigravity model must be inherit, flash, or pro")
    return f"agents/{identifier}.md", markdown(result, body)


def command(fields, body, identifier):
    result = {"name": identifier, **command_fields(fields), "disable-model-invocation": True}
    return f"skills/{identifier}/SKILL.md", markdown(result, body.replace("$ARGUMENTS", "the user's supplied arguments"))