import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export function locateWorkspace(start = process.cwd()) {
  let current = resolve(start);
  while (true) {
    if (existsSync(join(current, "skills-repo.config.json"))) return current;
    const parent = dirname(current);
    if (parent === current) return resolve(start);
    current = parent;
  }
}

export function readWorkspaceManifest(root) {
  const path = join(root, "skills-repo.config.json");
  if (!existsSync(path)) return null;
  const config = JSON.parse(readFileSync(path, "utf8"));
  if (!config || typeof config !== "object")
    throw new Error("Managed config must be an object");
  return config;
}

export function locateSkillShelf(root, plugin) {
  return resolve(root, "plugins", plugin, "skills");
}
