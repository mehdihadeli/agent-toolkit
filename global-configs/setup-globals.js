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
    files: ["CLAUDE.md", "settings.json"],
  },
  {
    name: "Copilot CLI",
    sourceDir: path.join(SCRIPT_DIR, "copilot-cli"),
    targetDir: path.join(HOME, ".copilot"),
    files: ["copilot-instructions.md", "config.json"],
  },
  {
    name: "Repomix",
    sourceDir: path.join(SCRIPT_DIR, "repomix"),
    targetDir: path.join(HOME, ".repomix"),
    files: ["repomix.config.ts"],
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

function mergeVscodeSettings() {
  const sourcePath = path.join(SCRIPT_DIR, "vscode-copilot", "settings.json");

  let vscodeSettingsPath;
  if (IS_WINDOWS) {
    const appData = process.env.APPDATA;
    if (!appData) throw new Error("APPDATA environment variable not found.");
    vscodeSettingsPath = path.join(appData, "Code", "User", "settings.json");
  } else {
    vscodeSettingsPath = path.join(
      HOME,
      ".config",
      "Code",
      "User",
      "settings.json",
    );
  }

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

function main() {
  console.log("🔧 Deploying Global AI Configurations...\n");

  for (const target of TARGETS) {
    console.log(`${target.name}:`);
    fs.mkdirSync(target.targetDir, { recursive: true });

    for (const file of target.files) {
      const sourceFile = path.join(target.sourceDir, file);
      const targetFile = path.join(target.targetDir, file);

      if (!fs.existsSync(sourceFile)) {
        console.warn(`  ⚠ Source file missing: ${sourceFile}`);
        continue;
      }
      linkOrCopy(sourceFile, targetFile);
    }
  }

  console.log("\nVS Code Copilot:");
  mergeVscodeSettings();

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
