from .base import agent_fields, command_fields, markdown

TOOLS = {
    "Read": "read", "Write": "edit", "Edit": "edit", "MultiEdit": "edit",
    "Bash": "execute", "Grep": "search", "Glob": "search",
    "Task": "agent", "Agent": "agent", "WebFetch": "web", "WebSearch": "web", "TodoWrite": "todo",
}


def agent(fields, body, identifier, model=None):
    result = {"name": identifier, **agent_fields(fields, TOOLS, model)}
    return f"agents/{identifier}.agent.md", markdown(result, body)


def command(fields, body, identifier):
    result = {"name": identifier, **command_fields(fields), "disable-model-invocation": True}
    return f"skills/{identifier}/SKILL.md", markdown(result, body.replace("$ARGUMENTS", "the user's supplied arguments"))