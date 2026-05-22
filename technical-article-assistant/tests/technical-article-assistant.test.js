const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const plugin = require("../scripts/technical-article-assistant.js");

const pluginRoot = path.join(__dirname, "..");

function readPluginFile(relativePath) {
  return fs.readFileSync(path.join(pluginRoot, relativePath), "utf8");
}

test("parseArgs handles positional, keyed, inline, and boolean options", () => {
  const parsed = plugin.parseArgs([
    "Productionizing agent memory",
    "--category",
    "ai",
    "--keywords=ai,memory,architecture",
    "--publish",
  ]);

  assert.deepEqual(parsed.positional, ["Productionizing agent memory"]);
  assert.equal(parsed.options.category, "ai");
  assert.equal(parsed.options.keywords, "ai,memory,architecture");
  assert.equal(parsed.options.publish, true);
});

test("renderTemplate replaces placeholders without leaving raw tokens", () => {
  const rendered = plugin.renderTemplate("brief.md", {
    title: "Agent Boundaries",
    slug: "agent-boundaries",
    articleType: "deep-dive",
    category: "ai",
    audience: "staff engineers",
    persona: "software architect and AI engineer",
    keywords: plugin.serializeInlineYamlArray(["ai", "architecture"]),
    date: "2026-05-22",
    thesis: "Clear boundaries make agent systems operable.",
    readerOutcome: "choose a better boundary model",
  });

  assert.match(rendered, /title: "Agent Boundaries"/);
  assert.match(rendered, /keywords: \["ai", "architecture"\]/);
  assert.doesNotMatch(rendered, /\{\s*\{\s*keywords\s*\}\s*}/);
});

test("buildArticleWorkspaceFiles includes core article assets", () => {
  const files = plugin.buildArticleWorkspaceFiles(plugin.defaultConfig, {
    title: "Modern .NET delivery architecture",
    slug: "modern-dotnet-delivery-architecture",
    articleType: "deep-dive",
    category: "dotnet",
    audience: "architects",
    keywords: "dotnet,devops,architecture",
    thesis: "Delivery architecture deserves explicit design.",
    readerOutcome: "design a safer delivery pipeline",
  });

  const filePaths = new Set(files.map((item) => item.path));
  assert(filePaths.has("01-brief.md"));
  assert(filePaths.has("02-outline.md"));
  assert(filePaths.has("03-draft.md"));
  assert(filePaths.has("04-review.md"));
  assert(filePaths.has("sources.md"));
  assert(filePaths.has(path.join("assets", "README.md")));
});

test("plugin manifests, command docs, and skills exist", () => {
  const rootManifest = JSON.parse(readPluginFile("plugin.json"));
  const claudeManifest = JSON.parse(
    readPluginFile(".claude-plugin/plugin.json"),
  );
  const skill = readPluginFile("skills/architect-blog-writing/SKILL.md");
  const command = readPluginFile("commands/brief.md");

  assert.equal(rootManifest.name, "technical-article-assistant");
  assert.equal(claudeManifest.name, "technical-article-assistant");
  assert.match(skill, /software architect or AI engineer/);
  assert.match(
    command,
    /\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/technical-article-assistant\.js/,
  );
});
