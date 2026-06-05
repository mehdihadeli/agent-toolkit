#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const SCRIPT_DIR = __dirname;
const HOME = os.homedir();
const IS_WINDOWS = os.platform() === "win32";

const TARGETS = [
  {
    name: "Claude Code",
    sourceDir: path.join(SCRIPT_DIR, "claude"),
    targetDir: path.join(HOME, ".claude"),
    files: [
      { source: "CLAUDE.md" },
      { source: "settings.json" },
      { source: ".claude.json", targetDir: HOME },
    ],
  },
  {
    name: "Copilot CLI",
    sourceDir: path.join(SCRIPT_DIR, "copilot-cli"),
    targetDir: path.join(HOME, ".copilot"),
    files: [
      { source: "copilot-instructions.md" },
      { source: "config.json" },
      { source: "mcp-config.json" },
    ],
  },
  {
    name: "Repomix",
    sourceDir: path.join(SCRIPT_DIR, "repomix"),
    targetDir: path.join(HOME, ".repomix"),
    files: [{ source: "repomix.config.ts" }],
  },
];

function linkOrCopy(source, target) {
  try {
    if (fs.existsSync(target)) {
      fs.unlinkSync(target);
    }
    fs.symlinkSync(source, target, "file");
    console.log(`  ✓ Linked: ${target}`);
  } catch (error) {
    fs.copyFileSync(source, target);
    console.log(`  ✓ Copied: ${target}`);
  }
}

function getVscodeUserDir() {
  if (IS_WINDOWS) {
    const appData = process.env.APPDATA;
    if (!appData) throw new Error("APPDATA environment variable not found.");
    return path.join(appData, "Code", "User");
  }

  return path.join(HOME, ".config", "Code", "User");
}

function mergeUniqueItemsById(existing = [], incoming = []) {
  const merged = new Map();

  for (const item of existing) {
    if (item && typeof item === "object" && "id" in item) {
      merged.set(item.id, item);
    }
  }

  for (const item of incoming) {
    if (item && typeof item === "object" && "id" in item) {
      merged.set(item.id, item);
    }
  }

  return [...merged.values()];
}

function mergeJsonConfig(
  targetPath,
  sourcePath,
  objectKeys = [],
  arrayKeys = [],
) {
  const existing = fs.existsSync(targetPath)
    ? JSON.parse(fs.readFileSync(targetPath, "utf8"))
    : {};
  const incoming = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  const merged = { ...existing, ...incoming };

  for (const key of objectKeys) {
    if (existing[key] || incoming[key]) {
      merged[key] = {
        ...(existing[key] ?? {}),
        ...(incoming[key] ?? {}),
      };
    }
  }

  for (const key of arrayKeys) {
    if (Array.isArray(existing[key]) || Array.isArray(incoming[key])) {
      merged[key] = mergeUniqueItemsById(existing[key], incoming[key]);
    }
  }

  fs.writeFileSync(targetPath, JSON.stringify(merged, null, 2) + "\n", "utf8");
}

function mergeVscodeSettings() {
  const sourcePath = path.join(SCRIPT_DIR, "vscode-copilot", "settings.json");

  const vscodeUserDir = getVscodeUserDir();
  const vscodeSettingsPath = path.join(vscodeUserDir, "settings.json");

  if (!fs.existsSync(vscodeSettingsPath)) {
    console.log(`  ⚠ VS Code settings not found at ${vscodeSettingsPath}`);
    return;
  }

  try {
    const existing = JSON.parse(fs.readFileSync(vscodeSettingsPath, "utf8"));
    const incoming = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    const merged = { ...existing, ...incoming };

    if (IS_WINDOWS && existing["terminal.integrated.profiles.windows"]) {
      merged["terminal.integrated.profiles.windows"] =
        existing["terminal.integrated.profiles.windows"];
    }

    fs.writeFileSync(
      vscodeSettingsPath,
      JSON.stringify(merged, null, 2) + "\n",
      "utf8",
    );
    console.log(`  ✓ Merged VS Code settings`);
  } catch (error) {
    console.error(`  ✗ Failed to merge VS Code settings: ${error.message}`);
  }
}

function mergeVscodeMcpConfig() {
  const sourcePath = path.join(SCRIPT_DIR, "vscode-copilot", "mcp.json");
  const vscodeUserDir = getVscodeUserDir();
  const targetPath = path.join(vscodeUserDir, "mcp.json");

  fs.mkdirSync(vscodeUserDir, { recursive: true });

  try {
    mergeJsonConfig(targetPath, sourcePath, ["servers"], ["inputs"]);
    console.log("  ✓ Merged VS Code MCP config");
  } catch (error) {
    console.error(`  ✗ Failed to merge VS Code MCP config: ${error.message}`);
  }
}

function main() {
  console.log("🔧 Deploying Global AI Configurations...\n");

  for (const target of TARGETS) {
    console.log(`${target.name}:`);
    fs.mkdirSync(target.targetDir, { recursive: true });

    for (const file of target.files) {
      const sourceFile = path.join(target.sourceDir, file.source);
      const targetFile = path.join(
        file.targetDir ?? target.targetDir,
        file.targetName ?? file.source,
      );

      if (!fs.existsSync(sourceFile)) {
        console.warn(`  ⚠ Source file missing: ${sourceFile}`);
        continue;
      }

      fs.mkdirSync(path.dirname(targetFile), { recursive: true });
      linkOrCopy(sourceFile, targetFile);
    }
  }

  console.log("\nVS Code Copilot:");
  mergeVscodeSettings();
  mergeVscodeMcpConfig();

  console.log("\n✅ Done. Restart your AI tools to apply changes.");
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  linkOrCopy,
  mergeVscodeSettings,
  TARGETS,
};
