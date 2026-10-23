# Workspace Routing

Resolve ownership before collecting prose. Start at the requested plugin and
walk upward until the repository marker is found; then locate its populated
`plugins/<plugin>/skills/` shelf. Do not invent a shelf when the plugin is
missing or when several candidate roots compete.

Generated source belongs inside the selected shelf. Tests belong in the
mirrored `tests/<plugin>/skills/<name>/` tree. Plugin README registration is a
separate, explicit operation and marketplace metadata is outside this
workflow.

When routing is ambiguous, stop with a diagnostic that names the competing
paths. A safe refusal is preferable to creating a valid-looking skill in the
wrong plugin.