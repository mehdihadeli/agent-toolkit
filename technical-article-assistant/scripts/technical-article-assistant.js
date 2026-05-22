#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const pluginRoot = path.resolve(__dirname, "..");
const defaultConfig = {
  articleRoot: "content/blog",
  seriesRoot: "content/series",
  researchRoot: "research",
  persona: "software architect and AI engineer",
  defaultAudience: "staff-plus engineers, architects, and platform teams",
  focusAreas: ["ai", "dotnet", "software-architecture", "devops"],
};

function printHelp() {
  console.log(`technical-article-assistant

Usage:
  technical-article-assistant init [--article-root path] [--series-root path] [--research-root path]
  technical-article-assistant brief <topic> [--category ai] [--audience text] [--article-type deep-dive] [--keywords a,b,c] [--thesis text]
  technical-article-assistant outline <topic-or-directory> [--category ai]
  technical-article-assistant review <topic-or-directory> [--category ai]
  technical-article-assistant series <theme> [--audience text]
`);
}

const configDirectoryNames = [
  ".technical-article-assistant",
  ".technical-blog-studio",
];

function parseArgs(args) {
  const positional = [];
  const options = {};

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }

    const inlineIndex = token.indexOf("=");
    if (inlineIndex !== -1) {
      const key = token.slice(2, inlineIndex);
      options[key] = token.slice(inlineIndex + 1);
      continue;
    }

    const key = token.slice(2);
    const nextToken = args[index + 1];
    if (!nextToken || nextToken.startsWith("--")) {
      options[key] = true;
      continue;
    }

    options[key] = nextToken;
    index += 1;
  }

  return { positional, options };
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function titleFromSlug(value) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function serializeInlineYamlArray(items) {
  const values = items
    .filter(Boolean)
    .map((item) => `"${escapeYamlString(item)}"`);
  return `[${values.join(", ")}]`;
}

function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function escapeYamlString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function renderTemplate(templateName, variables) {
  const template = fs.readFileSync(
    path.join(pluginRoot, "templates", templateName),
    "utf8",
  );
  return template.replace(
    /{{\s*(\w+)\s*}}|{\s*{\s*(\w+)\s*}\s*}/g,
    (_match, compactKey, spacedKey) => {
      const key = compactKey || spacedKey;
      return Object.prototype.hasOwnProperty.call(variables, key)
        ? String(variables[key])
        : "";
    },
  );
}

function resolveProjectRoot(startDir = process.cwd()) {
  let currentDir = path.resolve(startDir);

  while (true) {
    for (const configDirectoryName of configDirectoryNames) {
      const configPath = path.join(
        currentDir,
        configDirectoryName,
        "config.json",
      );
      if (fs.existsSync(configPath)) {
        return currentDir;
      }
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return path.resolve(startDir);
    }
    currentDir = parentDir;
  }
}

function configPathFor(projectRoot) {
  return path.join(projectRoot, ".technical-article-assistant", "config.json");
}

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function loadConfig(projectRoot) {
  const configPath = configPathFor(projectRoot);
  if (!fs.existsSync(configPath)) {
    throw new Error(
      "Technical Article Assistant is not initialized. Run init first.",
    );
  }

  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function saveConfig(projectRoot, config) {
  const configPath = configPathFor(projectRoot);
  ensureDirectory(path.dirname(configPath));
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}${os.EOL}`);
}

function buildArticleWorkspaceFiles(config, input) {
  const keywords = splitCsv(input.keywords || config.focusAreas.join(","));
  const variables = {
    title: input.title,
    slug: input.slug,
    articleType: input.articleType,
    category: input.category,
    audience: input.audience,
    persona: config.persona,
    keywords: serializeInlineYamlArray(keywords),
    date: today(),
    thesis: input.thesis,
    readerOutcome: input.readerOutcome,
  };

  return [
    { path: "01-brief.md", content: renderTemplate("brief.md", variables) },
    { path: "02-outline.md", content: renderTemplate("outline.md", variables) },
    { path: "03-draft.md", content: renderTemplate("draft.md", variables) },
    { path: "04-review.md", content: renderTemplate("review.md", variables) },
    { path: "sources.md", content: renderTemplate("sources.md", variables) },
    {
      path: path.join("assets", "README.md"),
      content:
        "# Assets\n\n- Diagrams\n- Benchmarks\n- Screenshots\n- Code snippets\n",
    },
  ];
}

function buildSeriesFile(config, input) {
  const variables = {
    title: input.title,
    slug: input.slug,
    audience: input.audience || config.defaultAudience,
    date: today(),
  };

  return renderTemplate("series.md", variables);
}

function writeFiles(baseDir, files) {
  for (const file of files) {
    const targetPath = path.join(baseDir, file.path);
    ensureDirectory(path.dirname(targetPath));
    fs.writeFileSync(targetPath, file.content);
  }
}

function resolveArticleDirectory(projectRoot, config, topicOrDirectory) {
  const candidate = path.resolve(projectRoot, topicOrDirectory);
  if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
    return candidate;
  }

  const slug = slugify(topicOrDirectory);
  return path.join(projectRoot, config.articleRoot, `${today()}-${slug}`);
}

function inferTitleFromDirectory(directoryPath) {
  const baseName = path.basename(directoryPath);
  const slug = baseName.replace(/^\d{4}-\d{2}-\d{2}-/, "");
  return titleFromSlug(slug);
}

function handleInit(options, cwd) {
  const projectRoot = path.resolve(cwd);
  const config = {
    ...defaultConfig,
    articleRoot: options["article-root"] || defaultConfig.articleRoot,
    seriesRoot: options["series-root"] || defaultConfig.seriesRoot,
    researchRoot: options["research-root"] || defaultConfig.researchRoot,
    persona: options.persona || defaultConfig.persona,
    defaultAudience: options.audience || defaultConfig.defaultAudience,
  };

  saveConfig(projectRoot, config);
  ensureDirectory(path.join(projectRoot, config.articleRoot));
  ensureDirectory(path.join(projectRoot, config.seriesRoot));
  ensureDirectory(path.join(projectRoot, config.researchRoot));

  console.log(`Initialized Technical Article Assistant in ${projectRoot}`);
  console.log(
    `- Config: ${path.relative(projectRoot, configPathFor(projectRoot))}`,
  );
  console.log(`- Articles: ${config.articleRoot}`);
  console.log(`- Series: ${config.seriesRoot}`);
  console.log(`- Research: ${config.researchRoot}`);
}

function handleBrief(parsed, cwd) {
  const projectRoot = resolveProjectRoot(cwd);
  const config = loadConfig(projectRoot);
  const topic = parsed.positional.join(" ").trim();

  if (!topic) {
    throw new Error("brief requires a topic.");
  }

  const slug = slugify(parsed.options.slug || topic);
  const articleDir = path.join(
    projectRoot,
    config.articleRoot,
    `${today()}-${slug}`,
  );
  const files = buildArticleWorkspaceFiles(config, {
    title: topic,
    slug,
    articleType: parsed.options["article-type"] || "deep-dive",
    category: parsed.options.category || "software-architecture",
    audience: parsed.options.audience || config.defaultAudience,
    keywords: parsed.options.keywords || config.focusAreas.join(","),
    thesis:
      parsed.options.thesis ||
      `Explain the architectural trade-offs, implementation boundaries, and operational consequences of ${topic}.`,
    readerOutcome:
      parsed.options.outcome ||
      `make a better design or implementation decision about ${topic}`,
  });

  writeFiles(articleDir, files);
  console.log(`Created article workspace: ${articleDir}`);
}

function handleOutline(parsed, cwd) {
  const projectRoot = resolveProjectRoot(cwd);
  const config = loadConfig(projectRoot);
  const topicOrDirectory = parsed.positional.join(" ").trim();

  if (!topicOrDirectory) {
    throw new Error("outline requires a topic or article directory.");
  }

  const articleDir = resolveArticleDirectory(
    projectRoot,
    config,
    topicOrDirectory,
  );
  ensureDirectory(articleDir);
  const title = fs.existsSync(path.join(articleDir, "01-brief.md"))
    ? inferTitleFromDirectory(articleDir)
    : topicOrDirectory;

  const content = renderTemplate("outline.md", {
    title,
    slug: slugify(title),
    date: today(),
  });
  fs.writeFileSync(path.join(articleDir, "02-outline.md"), content);
  console.log(`Wrote outline: ${path.join(articleDir, "02-outline.md")}`);
}

function handleReview(parsed, cwd) {
  const projectRoot = resolveProjectRoot(cwd);
  const config = loadConfig(projectRoot);
  const topicOrDirectory = parsed.positional.join(" ").trim();

  if (!topicOrDirectory) {
    throw new Error("review requires a topic or article directory.");
  }

  const articleDir = resolveArticleDirectory(
    projectRoot,
    config,
    topicOrDirectory,
  );
  ensureDirectory(articleDir);
  const title = inferTitleFromDirectory(articleDir);
  const content = renderTemplate("review.md", {
    title,
    slug: slugify(title),
    date: today(),
  });
  fs.writeFileSync(path.join(articleDir, "04-review.md"), content);
  console.log(`Wrote review gate: ${path.join(articleDir, "04-review.md")}`);
}

function handleSeries(parsed, cwd) {
  const projectRoot = resolveProjectRoot(cwd);
  const config = loadConfig(projectRoot);
  const theme = parsed.positional.join(" ").trim();

  if (!theme) {
    throw new Error("series requires a theme.");
  }

  const slug = slugify(theme);
  const seriesFile = path.join(projectRoot, config.seriesRoot, `${slug}.md`);
  ensureDirectory(path.dirname(seriesFile));
  fs.writeFileSync(
    seriesFile,
    buildSeriesFile(config, {
      title: theme,
      slug,
      audience: parsed.options.audience,
    }),
  );
  console.log(`Created series plan: ${seriesFile}`);
}

function main(argv = process.argv.slice(2), cwd = process.cwd()) {
  const [command, ...rest] = argv;
  if (!command || command === "help" || command === "--help") {
    printHelp();
    return;
  }

  const parsed = parseArgs(rest);

  switch (command) {
    case "init":
      handleInit(parsed.options, cwd);
      return;
    case "brief":
      handleBrief(parsed, cwd);
      return;
    case "outline":
      handleOutline(parsed, cwd);
      return;
    case "review":
      handleReview(parsed, cwd);
      return;
    case "series":
      handleSeries(parsed, cwd);
      return;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
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
  buildArticleWorkspaceFiles,
  buildSeriesFile,
  defaultConfig,
  escapeYamlString,
  main,
  parseArgs,
  renderTemplate,
  serializeInlineYamlArray,
  slugify,
  splitCsv,
  titleFromSlug,
  today,
};
