const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const plugin = require("../scripts/obsidian-vault.js");

const pluginRoot = path.join(__dirname, "..");

function readPluginFile(relativePath) {
  return fs.readFileSync(path.join(pluginRoot, relativePath), "utf8");
}

test("parseArgs handles positional, keyed, inline, and boolean options", () => {
  const parsed = plugin.parseArgs([
    "technologies/dotnet",
    "Minimal APIs",
    "--description",
    "API notes",
    "--tags=dotnet,webapi",
    "--show",
  ]);

  assert.deepEqual(parsed.positional, ["technologies/dotnet", "Minimal APIs"]);
  assert.equal(parsed.options.description, "API notes");
  assert.equal(parsed.options.tags, "dotnet,webapi");
  assert.equal(parsed.options.show, true);
});

test("renderTemplate renders note placeholders without leaving raw tokens", () => {
  const rendered = plugin.renderTemplate("note.md", {
    title: "Minimal APIs",
    description: "ASP.NET Core endpoint notes",
    domain: "technologies/dotnet",
    tags: plugin.serializeInlineYamlArray(["dotnet", "software-engineering"]),
    related: plugin.serializeInlineYamlArray([
      "[[software-engineering/README]]",
    ]),
    date: "2026-05-22",
    content: "Document endpoint conventions.",
  });

  assert.match(rendered, /title: "Minimal APIs"/);
  assert.match(rendered, /tags: \["dotnet", "software-engineering"\]/);
  assert.match(rendered, /related: \["\[\[software-engineering\/README\]\]"\]/);
  assert.doesNotMatch(rendered, /\{\s*\{\s*tags\s*\}\s*\}/);
  assert.doesNotMatch(rendered, /\{\s*\{\s*related\s*\}\s*\}/);
});

test("buildSeedFiles includes core technology and concept indexes", () => {
  const seedFiles = plugin.buildSeedFiles({
    workspaceRoot: "software-engineering",
  });
  const paths = new Set(seedFiles.map((item) => item.path));

  assert(paths.has("software-engineering/README.md"));
  assert(paths.has("software-engineering/technologies/dotnet/README.md"));
  assert(paths.has("software-engineering/technologies/ai/README.md"));
  assert(paths.has("software-engineering/technologies/docker/README.md"));
  assert(paths.has("software-engineering/technologies/kubernetes/README.md"));
  assert(
    paths.has("software-engineering/concepts/software-architecture/README.md"),
  );
  assert(
    paths.has("software-engineering/concepts/distributed-systems/README.md"),
  );
  assert(paths.has("software-engineering/concepts/testing/README.md"));
});

test("workspace path helpers normalize plugin note locations", () => {
  const config = { workspaceRoot: "software-engineering" };

  assert.equal(
    plugin.withWorkspaceRoot(config, "technologies/dotnet"),
    "software-engineering/technologies/dotnet",
  );
  assert.equal(
    plugin.withWorkspaceRoot(
      config,
      "software-engineering/technologies/dotnet",
    ),
    "software-engineering/technologies/dotnet",
  );
  assert.equal(
    plugin.stripWorkspaceRoot(
      config,
      "software-engineering/technologies/dotnet",
    ),
    "technologies/dotnet",
  );
  assert.equal(
    plugin.formatRelatedLink("software-engineering/README.md"),
    "[[software-engineering/README]]",
  );
});

test("plugin package, commands, and skill files exist in the moved folder", () => {
  const packageJson = JSON.parse(readPluginFile(".claude-plugin/plugin.json"));
  const skill = readPluginFile("skills/vault-management/SKILL.md");
  const addCommand = readPluginFile("commands/add.md");
  const updateCommand = readPluginFile("commands/update.md");

  assert.equal(packageJson.name, "obsidian-vault");
  assert.match(skill, /name: vault-management/);
  assert.match(skill, /software-engineering\//);
  assert.match(
    addCommand,
    /\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/obsidian-vault\.js/,
  );
  assert.match(
    updateCommand,
    /\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/obsidian-vault\.js/,
  );
});
