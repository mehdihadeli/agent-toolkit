import { defineConfig } from "repomix";

export default defineConfig({
  input: {
    maxFileSize: 52_428_800, // 50MB in bytes
  },

  output: {
    style: "markdown",
    parsableStyle: true,
    fileSummary: true,
    directoryStructure: true,
    files: true,
    removeComments: false,
    removeEmptyLines: false,
    compress: false,
    topFilesLength: 5,
    showLineNumbers: false,
    truncateBase64: false,
    copyToClipboard: true,
    includeFullDirectoryStructure: false,
    tokenCountTree: false,
    git: {
      sortByChanges: true,
      sortByChangesMaxCommits: 100,
      includeDiffs: false,
      includeLogs: false,
      includeLogsCount: 50,
    },
  },

  include: [],

  ignore: {
    // Respect .gitignore files from your projects
    useGitignore: true,

    // Respect .ignore files
    useDotIgnore: true,

    // Use built-in default patterns (node_modules, .git, etc.)
    useDefaultPatterns: true,

    // Custom patterns - these will be applied in addition to .gitignore rules
    customPatterns: [
      ".git", // Git version control
      ".agents", // Agents directory
      ".github", // GitHub workflows/settings
      ".idea", // IntelliJ IDEA IDE
      "**/global.json",
      "**/dotnet-tools.json",
      "**/.editorconfig",
      "**/.dockerignore",
      "**/obj",
      "**/bin",
      "**/skills-lock.json",
      "**/.gitattributes",
      "**/.gitignore", // Add this to EXCLUDE the .gitignore files themselves, but it is usefull for AI
      "**/.sln",
      "**/.slnx",
    ],
  },

  security: {
    enableSecurityCheck: true,
  },

  tokenCount: {
    encoding: "o200k_base",
  },
});
