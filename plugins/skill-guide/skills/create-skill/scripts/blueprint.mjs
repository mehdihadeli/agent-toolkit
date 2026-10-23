export function blueprintFiles({ name, summary, useFor, doNotUseFor, plugin }) {
  const description = `${summary.trim()} USE FOR: ${useFor.trim()} DO NOT USE FOR: ${doNotUseFor.trim()}`;
  return {
    "SKILL.md": `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n\n## Workflow\n\n1. Gather required context.\n2. Perform the skill-specific work.\n3. Validate the result and report risks or unknowns.\n`,
    "README.md": `# ${name}\n\n${summary.trim()}\n\nKeep references and production scripts beside this skill. Keep tests under tests/${plugin}/skills/${name}/.\n`,
  };
}
