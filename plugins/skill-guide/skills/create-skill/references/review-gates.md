# Review Gates

Treat generated skill files as a proposal until a reviewer can see the exact
paths, content inputs, and approval digest. Preview output must be reproducible
from the same arguments, and approval must reject any changed field.

Use three checks before applying a proposal:

1. **Ownership**: target sits under the selected plugin's skill shelf.
2. **Shape**: generated files contain required frontmatter, workflow steps,
   and repository-local test guidance.
3. **Collision**: destination does not already exist and no existing README
   entry is silently replaced.

Keep external services out of the generator. A caller may review or enrich the
proposal later, but creation itself must remain deterministic and offline.