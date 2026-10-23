from .base import agent_fields, command_fields, markdown

TOOLS = {
    "Read": "read", "Write": "edit", "Edit": "edit", "MultiEdit": "edit",
    "Bash": "shell", "Grep": "grep", "Glob": "glob", "LS": "list",
    "Task": "task", "Agent": "task", "Skill": "skill", "LSP": "lsp",
    "WebFetch": "webfetch", "WebSearch": "websearch", "AskUserQuestion": "question",
}


def agent(fields, body, identifier, model=None):
    result = agent_fields(fields, TOOLS, model)
    selected = result.pop("tools", None)
    result["mode"] = "subagent"
    if selected is not None:
        result["permission"] = {"*": "deny", **{tool: "allow" for tool in selected}}
    return f"agents/{identifier}.md", markdown(result, body)


def command(fields, body, identifier):
    return f"commands/{identifier}.md", markdown(command_fields(fields), body)