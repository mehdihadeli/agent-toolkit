import { existsSync, readFileSync } from "node:fs";

const MARKER = "## Skills";

export function catalogEntry({ name, summary }) {
  return { name, text: `### \`${name}\`\n\n${summary.trim()}\n` };
}

export function updateCatalog(path, entry) {
  const content = existsSync(path)
    ? readFileSync(path, "utf8")
    : "# Plugin\n\n";
  if (content.includes(`### \`${entry.name}\``))
    throw new Error("Skill is already registered");
  const marker = content.includes(MARKER)
    ? `${MARKER}\n`
    : `${content.trimEnd()}\n\n${MARKER}\n`;
  return content.includes(MARKER)
    ? content.replace(`${MARKER}\n`, `${MARKER}\n\n${entry.text}\n`)
    : `${marker}\n${entry.text}\n`;
}
