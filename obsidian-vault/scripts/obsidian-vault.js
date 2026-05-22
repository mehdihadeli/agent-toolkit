#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const https = require("node:https");

const CONFIG_PATH = path.join(os.homedir(), ".claude", "obsidian-vault.json");
const DEFAULT_CONFIG = {
  baseUrl: "https://127.0.0.1:27124",
  allowInsecureTls: true,
  apiKeyEnv: "OBSIDIAN_REST_API_KEY",
  workspaceRoot: "software-engineering",
};

const command = process.argv[2];
const argv = process.argv.slice(3);

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

async function main() {
  switch (command) {
    case "init":
      await handleInit(parseArgs(argv));
      return;
    case "add":
      await handleAdd(parseArgs(argv));
      return;
    case "list":
      await handleList(parseArgs(argv));
      return;
    case "search":
      await handleSearch(parseArgs(argv));
      return;
    case "update":
      await handleUpdate(parseArgs(argv));
      return;
    case "tags":
      await handleTags(parseArgs(argv));
      return;
    case "help":
    case undefined:
      printHelp();
      return;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

function printHelp() {
  console.log(`obsidian-vault commands:

  init   [--check] [--protocol http|https] [--host 127.0.0.1] [--port 27124] [--workspace-root software-engineering] [--seed-template]
  add    <domain> <title> [--description text] [--tags tag1,tag2] [--related path1,path2] [--content text]
  list   [domain-or-path]
  search <query>
  update <path-or-title> [--title text] [--description text] [--add-tags tag1,tag2] [--set-tags tag1,tag2] [--add-related path1,path2] [--append markdown] [--show]
  tags   [filter]
`);
}

function parseArgs(items) {
  const positional = [];
  const options = {};

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];

    if (!item.startsWith("--")) {
      positional.push(item);
      continue;
    }

    const [rawKey, inlineValue] = item.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      options[rawKey] = inlineValue;
      continue;
    }

    const nextValue = items[index + 1];
    if (!nextValue || nextValue.startsWith("--")) {
      options[rawKey] = true;
      continue;
    }

    options[rawKey] = nextValue;
    index += 1;
  }

  return { positional, options };
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    return { ...DEFAULT_CONFIG };
  }

  const raw = fs.readFileSync(CONFIG_PATH, "utf8");
  return {
    ...DEFAULT_CONFIG,
    ...JSON.parse(raw),
  };
}

function saveConfig(config) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function resolveApiKey(config) {
  if (config.apiKey) {
    return config.apiKey;
  }

  if (config.apiKeyEnv && process.env[config.apiKeyEnv]) {
    return process.env[config.apiKeyEnv];
  }

  return "";
}

async function handleInit({ options }) {
  const protocol =
    options.protocol ||
    guessProtocol(options.port) ||
    new URL(loadConfig().baseUrl).protocol.replace(":", "");
  const host = options.host || "127.0.0.1";
  const port = String(options.port || (protocol === "http" ? 27123 : 27124));
  const workspaceRoot = normalizePath(
    options["workspace-root"] || loadConfig().workspaceRoot,
  );
  const config = {
    ...loadConfig(),
    baseUrl: `${protocol}://${host}:${port}`,
    workspaceRoot,
    allowInsecureTls:
      options["allow-insecure-tls"] !== undefined
        ? parseBooleanOption(options["allow-insecure-tls"], true)
        : true,
  };

  saveConfig(config);
  const status = await request(config, "GET", "/", {
    allowUnauthenticated: true,
  });

  if (status.statusCode !== 200) {
    throw new Error(
      `Could not reach Obsidian Local REST API at ${config.baseUrl}`,
    );
  }

  console.log(`Saved config to ${CONFIG_PATH}`);
  console.log(`Connected to ${config.baseUrl}`);

  if (options.check) {
    console.log("Check completed.");
    return;
  }

  if (options["seed-template"]) {
    await ensureAuthenticated(config);
    await seedWorkspace(config);
    console.log(`Seeded workspace root: ${config.workspaceRoot}`);
  }
}

async function handleAdd({ positional, options }) {
  const [domain, title] = positional;
  if (!domain || !title) {
    throw new Error(
      "Usage: add <domain> <title> [--description ...] [--tags ...] [--related ...] [--content ...]",
    );
  }

  const config = loadConfig();
  await ensureAuthenticated(config);

  const normalizedDomain = withWorkspaceRoot(config, domain);
  const notePath = joinVaultPath(normalizedDomain, `${slugify(title)}.md`);
  const date = today();
  const tags = uniqueItems([
    ...splitCsv(options.tags),
    ...inferTagsFromDomain(domain),
    "software-engineering",
  ]);
  const related = splitCsv(options.related).map(formatRelatedLink);
  const content = renderTemplate("note.md", {
    title,
    description: options.description || title,
    domain: stripWorkspaceRoot(config, normalizedDomain),
    tags: serializeInlineYamlArray(tags),
    related: serializeInlineYamlArray(related),
    date,
    content:
      options.content || "Add the main ideas, examples, and references here.",
  });

  await putFile(config, notePath, content, false);
  console.log(notePath);
}

async function handleList({ positional }) {
  const config = loadConfig();
  await ensureAuthenticated(config);
  const scope = positional[0]
    ? withWorkspaceRoot(config, positional[0])
    : config.workspaceRoot;
  const response = await request(config, "GET", directoryEndpoint(scope));

  assertOk(response, `Could not list ${scope}`);
  const files = response.body.files || [];
  for (const file of files) {
    console.log(file);
  }
}

async function handleSearch({ positional }) {
  const query = positional.join(" ").trim();
  if (!query) {
    throw new Error("Usage: search <query>");
  }

  const config = loadConfig();
  await ensureAuthenticated(config);
  const response = await request(
    config,
    "POST",
    `/search/simple/?query=${encodeURIComponent(query)}&contextLength=120`,
    { headers: { "Content-Type": "application/json" }, body: "{}" },
  );

  assertOk(response, `Could not search for ${query}`);
  const results = (response.body || []).filter((item) =>
    item.filename.startsWith(`${config.workspaceRoot}/`),
  );

  for (const item of results) {
    console.log(`${item.filename}`);
    for (const match of item.matches || []) {
      console.log(`  ${trimLines(match.context)}`);
    }
  }
}

async function handleUpdate({ positional, options }) {
  const [identifier] = positional;
  if (!identifier) {
    throw new Error(
      "Usage: update <path-or-title> [--title ...] [--description ...] [--add-tags ...] [--set-tags ...] [--add-related ...] [--append ...] [--show]",
    );
  }

  const config = loadConfig();
  await ensureAuthenticated(config);
  const notePath = await resolveNotePath(config, identifier);

  if (options.show) {
    const response = await request(config, "GET", fileEndpoint(notePath), {
      headers: { Accept: "application/vnd.olrapi.note+json" },
    });
    assertOk(response, `Could not read ${notePath}`);
    console.log(response.body.content);
    return;
  }

  let didChange = false;

  if (options.title) {
    await patchFrontmatter(config, notePath, "title", options.title);
    didChange = true;
  }

  if (options.description) {
    await patchFrontmatter(
      config,
      notePath,
      "description",
      options.description,
    );
    didChange = true;
  }

  if (options["set-tags"]) {
    await patchFrontmatter(
      config,
      notePath,
      "tags",
      uniqueItems(splitCsv(options["set-tags"])),
      "replace",
      true,
    );
    didChange = true;
  }

  if (options["add-tags"]) {
    await patchFrontmatter(
      config,
      notePath,
      "tags",
      uniqueItems(splitCsv(options["add-tags"])),
      "append",
      true,
    );
    didChange = true;
  }

  if (options["add-related"]) {
    const related = splitCsv(options["add-related"]).map(formatRelatedLink);
    await patchFrontmatter(
      config,
      notePath,
      "related",
      uniqueItems(related),
      "append",
      true,
    );
    didChange = true;
  }

  if (options.append) {
    const appendResponse = await request(
      config,
      "POST",
      fileEndpoint(notePath),
      {
        headers: { "Content-Type": "text/markdown" },
        body: `${options.append}\n`,
      },
    );
    assertOk(appendResponse, `Could not append to ${notePath}`);
    didChange = true;
  }

  if (!didChange) {
    throw new Error(
      "Nothing to update. Provide at least one update flag or --show.",
    );
  }

  await patchFrontmatter(config, notePath, "updated", today());
  console.log(notePath);
}

async function handleTags({ positional }) {
  const filter = (positional[0] || "").toLowerCase();
  const config = loadConfig();
  await ensureAuthenticated(config);
  const response = await request(config, "GET", "/tags/");

  assertOk(response, "Could not retrieve tags");
  const tags = (response.body.tags || []).filter((tag) =>
    tag.name.toLowerCase().includes(filter),
  );
  for (const tag of tags) {
    console.log(`${tag.name}: ${tag.count}`);
  }
}

async function ensureAuthenticated(config) {
  const apiKey = resolveApiKey(config);
  if (!apiKey) {
    throw new Error(
      `Missing API key. Set ${config.apiKeyEnv || "OBSIDIAN_REST_API_KEY"} or add apiKey to ${CONFIG_PATH}.`,
    );
  }
}

async function seedWorkspace(config) {
  const seedFiles = buildSeedFiles(config);
  for (const item of seedFiles) {
    await putFile(config, item.path, item.content, true);
  }
}

function buildSeedFiles(config) {
  const date = today();
  const root = config.workspaceRoot;
  return [
    buildIndexSeed(
      root,
      "Software Engineering",
      "Root index for software engineering notes and learning paths.",
      ["software-engineering", "knowledge-base"],
      [
        `- [[${root}/technologies/README|Technologies]]`,
        `- [[${root}/concepts/README|Concepts]]`,
        `- [[${root}/patterns/README|Patterns]]`,
        `- [[${root}/project-notes/README|Project Notes]]`,
        `- [[${root}/references/README|References]]`,
        `- [[${root}/journal/README|Journal]]`,
        `- [[${root}/inbox/README|Inbox]]`,
      ],
      date,
    ),
    buildIndexSeed(
      `${root}/technologies`,
      "Technologies",
      "Technology-specific notes, experiments, setup guides, and implementation references.",
      ["technologies", "software-engineering"],
      [
        `- [[${root}/technologies/dotnet/README|.NET]]`,
        `- [[${root}/technologies/ai/README|AI]]`,
        `- [[${root}/technologies/docker/README|Docker]]`,
        `- [[${root}/technologies/kubernetes/README|Kubernetes]]`,
      ],
      date,
    ),
    buildIndexSeed(
      `${root}/technologies/dotnet`,
      ".NET",
      "Runtime, ASP.NET Core, libraries, tooling, and architecture notes for the .NET ecosystem.",
      ["dotnet", "technology", "software-engineering"],
      [
        "- ASP.NET Core",
        "- Minimal APIs",
        "- EF Core",
        "- Background services",
      ],
      date,
    ),
    buildIndexSeed(
      `${root}/technologies/ai`,
      "AI",
      "Notes about LLM applications, prompting, RAG, evaluation, and agent engineering.",
      ["ai", "technology", "software-engineering"],
      [
        "- Prompt engineering",
        "- Retrieval-augmented generation",
        "- Evaluation",
        "- Agent orchestration",
      ],
      date,
    ),
    buildIndexSeed(
      `${root}/technologies/docker`,
      "Docker",
      "Containerization patterns, local development workflows, image design, and operational notes.",
      ["docker", "technology", "software-engineering"],
      ["- Dockerfiles", "- Compose", "- Layer caching", "- Local debugging"],
      date,
    ),
    buildIndexSeed(
      `${root}/technologies/kubernetes`,
      "Kubernetes",
      "Cluster architecture, manifests, Helm, deployments, troubleshooting, and production practices.",
      ["kubernetes", "technology", "software-engineering"],
      [
        "- Workloads",
        "- Services and ingress",
        "- Config and secrets",
        "- Observability",
      ],
      date,
    ),
    buildIndexSeed(
      `${root}/concepts`,
      "Concepts",
      "Cross-cutting engineering concepts and principles.",
      ["concepts", "software-engineering"],
      [
        `- [[${root}/concepts/software-architecture/README|Software Architecture]]`,
        `- [[${root}/concepts/distributed-systems/README|Distributed Systems]]`,
        `- [[${root}/concepts/testing/README|Testing]]`,
      ],
      date,
    ),
    buildIndexSeed(
      `${root}/concepts/software-architecture`,
      "Software Architecture",
      "Architecture styles, tradeoffs, boundaries, system design, and decision records.",
      ["architecture", "concept", "software-engineering"],
      [
        "- Monoliths and modular monoliths",
        "- Clean architecture",
        "- Event-driven systems",
        "- ADRs",
      ],
      date,
    ),
    buildIndexSeed(
      `${root}/concepts/distributed-systems`,
      "Distributed Systems",
      "Coordination, messaging, resilience, scaling, and consistency notes.",
      ["distributed-systems", "concept", "software-engineering"],
      [
        "- Consistency models",
        "- Messaging",
        "- Retries and idempotency",
        "- Sagas",
      ],
      date,
    ),
    buildIndexSeed(
      `${root}/concepts/testing`,
      "Testing",
      "Testing strategy, unit and integration testing, automation, and quality signals.",
      ["testing", "concept", "software-engineering"],
      [
        "- Test pyramid",
        "- Contract testing",
        "- Snapshot and approval testing",
        "- Coverage tradeoffs",
      ],
      date,
    ),
    buildIndexSeed(
      `${root}/patterns`,
      "Patterns",
      "Reusable implementation patterns, design patterns, and delivery patterns.",
      ["patterns", "software-engineering"],
      ["- CQRS", "- Mediator", "- Outbox", "- Circuit breaker"],
      date,
    ),
    buildIndexSeed(
      `${root}/project-notes`,
      "Project Notes",
      "Project-specific decisions, milestones, and technical context.",
      ["projects", "software-engineering"],
      [
        "- Architecture decisions",
        "- Deployment notes",
        "- Risks and tradeoffs",
      ],
      date,
    ),
    buildIndexSeed(
      `${root}/references`,
      "References",
      "Cheat sheets, snippets, links, and external references worth keeping.",
      ["references", "software-engineering"],
      ["- Commands", "- Docs", "- Checklists"],
      date,
    ),
    buildIndexSeed(
      `${root}/journal`,
      "Journal",
      "Work log, implementation notes, and short-form capture for ongoing engineering work.",
      ["journal", "software-engineering"],
      ["- Daily notes", "- Debugging notes", "- Retrospectives"],
      date,
    ),
    buildIndexSeed(
      `${root}/inbox`,
      "Inbox",
      "Temporary capture area for ideas and notes before they are organized.",
      ["inbox", "software-engineering"],
      ["- Triage later", "- Promote to a durable topic when it stabilizes"],
      date,
    ),
  ];
}

function buildIndexSeed(directory, title, description, tags, topics, date) {
  const related =
    directory === directory.split("/")[0]
      ? []
      : [formatRelatedLink(`${directory.split("/")[0]}/README`)];
  return {
    path: joinVaultPath(directory, "README.md"),
    content: renderTemplate("index.md", {
      title,
      description,
      domain: directory,
      tags: serializeInlineYamlArray(tags),
      related: serializeInlineYamlArray(related),
      date,
      purpose: description,
      topics: topics.join("\n"),
    }),
  };
}

async function resolveNotePath(config, identifier) {
  if (identifier.includes("/") || identifier.endsWith(".md")) {
    return withWorkspaceRoot(config, identifier);
  }

  const exact = await request(config, "POST", "/search/", {
    headers: { "Content-Type": "application/vnd.olrapi.jsonlogic+json" },
    body: JSON.stringify({ "==": [{ var: "frontmatter.title" }, identifier] }),
  });

  if (exact.statusCode === 200) {
    const matches = (exact.body || []).filter((item) =>
      item.filename.startsWith(`${config.workspaceRoot}/`),
    );
    if (matches.length === 1) {
      return matches[0].filename;
    }
    if (matches.length > 1) {
      throw new Error(
        `Multiple notes match title '${identifier}': ${matches.map((item) => item.filename).join(", ")}`,
      );
    }
  }

  const fallback = await request(
    config,
    "POST",
    `/search/simple/?query=${encodeURIComponent(identifier)}&contextLength=40`,
    { headers: { "Content-Type": "application/json" }, body: "{}" },
  );
  assertOk(fallback, `Could not resolve ${identifier}`);

  const filtered = (fallback.body || []).filter((item) =>
    item.filename.startsWith(`${config.workspaceRoot}/`),
  );
  if (filtered.length === 1) {
    return filtered[0].filename;
  }
  if (filtered.length === 0) {
    throw new Error(`No note found for '${identifier}'.`);
  }

  throw new Error(
    `Multiple notes match '${identifier}': ${filtered.map((item) => item.filename).join(", ")}`,
  );
}

async function patchFrontmatter(
  config,
  notePath,
  key,
  value,
  operation = "replace",
  createIfMissing = true,
) {
  const response = await request(config, "PATCH", fileEndpoint(notePath), {
    headers: {
      "Content-Type": "application/json",
      Operation: operation,
      "Target-Type": "frontmatter",
      Target: key,
      "Create-Target-If-Missing": createIfMissing ? "true" : "false",
    },
    body: JSON.stringify(value),
  });
  assertOk(response, `Could not update ${key} on ${notePath}`);
}

async function putFile(config, notePath, content, skipIfExists) {
  if (skipIfExists) {
    const existing = await request(config, "GET", fileEndpoint(notePath));
    if (existing.statusCode === 200) {
      return;
    }
    if (existing.statusCode !== 404) {
      assertOk(existing, `Could not check ${notePath}`);
    }
  }

  const response = await request(config, "PUT", fileEndpoint(notePath), {
    headers: { "Content-Type": "text/markdown" },
    body: content,
  });
  assertOk(response, `Could not write ${notePath}`);
}

function renderTemplate(templateName, variables) {
  const templatePath = path.join(__dirname, "..", "templates", templateName);
  const template = fs.readFileSync(templatePath, "utf8");
  return template.replace(
    /{{\s*(\w+)\s*}}|{\s*{\s*(\w+)\s*}\s*}/g,
    (_, compactKey, spacedKey) => {
      const key = compactKey || spacedKey;
      const value = variables[key];
      return value === undefined ? "" : String(value);
    },
  );
}

function serializeInlineYamlArray(values) {
  return values.map((value) => `"${escapeYamlString(value)}"`).join(", ");
}

function splitCsv(value) {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function inferTagsFromDomain(domain) {
  const cleanDomain = normalizePath(domain);
  return cleanDomain
    .split("/")
    .filter(Boolean)
    .map((item) => item.replace(/[^a-zA-Z0-9.-]/g, "-"));
}

function formatRelatedLink(value) {
  if (!value) {
    return value;
  }
  if (value.startsWith("[[") && value.endsWith("]]")) {
    return value;
  }
  return `[[${value.replace(/\.md$/, "")}]]`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function normalizePath(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
}

function joinVaultPath(...parts) {
  return parts.map(normalizePath).filter(Boolean).join("/");
}

function withWorkspaceRoot(config, target) {
  const normalizedTarget = normalizePath(target);
  if (!normalizedTarget) {
    return config.workspaceRoot;
  }
  if (
    normalizedTarget === config.workspaceRoot ||
    normalizedTarget.startsWith(`${config.workspaceRoot}/`)
  ) {
    return normalizedTarget;
  }
  return joinVaultPath(config.workspaceRoot, normalizedTarget);
}

function stripWorkspaceRoot(config, target) {
  const normalizedTarget = normalizePath(target);
  if (normalizedTarget === config.workspaceRoot) {
    return "";
  }
  if (normalizedTarget.startsWith(`${config.workspaceRoot}/`)) {
    return normalizedTarget.slice(config.workspaceRoot.length + 1);
  }
  return normalizedTarget;
}

function fileEndpoint(vaultPath) {
  return `/vault/${encodeVaultPath(vaultPath)}`;
}

function directoryEndpoint(vaultPath) {
  if (!vaultPath) {
    return "/vault/";
  }
  return `/vault/${encodeVaultPath(vaultPath)}/`;
}

function encodeVaultPath(vaultPath) {
  return normalizePath(vaultPath)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function trimLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
}

function uniqueItems(values) {
  return [...new Set(values.filter(Boolean))];
}

function escapeYamlString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function guessProtocol(port) {
  if (String(port || "") === "27123") {
    return "http";
  }
  if (String(port || "") === "27124") {
    return "https";
  }
  return "";
}

function parseBooleanOption(value, defaultValue) {
  if (value === true || value === undefined) {
    return defaultValue;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return defaultValue;
}

function assertOk(response, message) {
  if (response.statusCode >= 200 && response.statusCode < 300) {
    return;
  }

  const details =
    typeof response.body === "string"
      ? response.body
      : response.body && response.body.message
        ? response.body.message
        : JSON.stringify(response.body);

  throw new Error(
    `${message}. HTTP ${response.statusCode}${details ? `: ${details}` : ""}`,
  );
}

function request(config, method, endpoint, options = {}) {
  const baseUrl = new URL(config.baseUrl);
  const url = new URL(endpoint, baseUrl);
  const apiKey = resolveApiKey(config);
  const transport = url.protocol === "https:" ? https : http;
  const headers = {
    ...(options.headers || {}),
  };

  if (!options.allowUnauthenticated && apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const body = options.body;
  if (body !== undefined && headers["Content-Length"] === undefined) {
    headers["Content-Length"] = Buffer.byteLength(body);
  }

  return new Promise((resolve, reject) => {
    const requestOptions = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: `${url.pathname}${url.search}`,
      headers,
    };

    if (url.protocol === "https:") {
      requestOptions.rejectUnauthorized = !config.allowInsecureTls;
    }

    const req = transport.request(requestOptions, (res) => {
      const chunks = [];

      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const rawBody = Buffer.concat(chunks).toString("utf8");
        const contentType = res.headers["content-type"] || "";
        let parsedBody = rawBody;

        if (contentType.includes("application/json") && rawBody) {
          parsedBody = JSON.parse(rawBody);
        }

        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body: parsedBody,
        });
      });
    });

    req.on("error", reject);

    if (body !== undefined) {
      req.write(body);
    }

    req.end();
  });
}

module.exports = {
  CONFIG_PATH,
  DEFAULT_CONFIG,
  buildSeedFiles,
  buildIndexSeed,
  encodeVaultPath,
  fileEndpoint,
  formatRelatedLink,
  inferTagsFromDomain,
  joinVaultPath,
  normalizePath,
  parseArgs,
  parseBooleanOption,
  renderTemplate,
  serializeInlineYamlArray,
  slugify,
  splitCsv,
  stripWorkspaceRoot,
  today,
  trimLines,
  uniqueItems,
  withWorkspaceRoot,
};
