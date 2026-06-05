const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const setupGlobals = require("../setup-globals.js");

test("installation directories target Claude Code and Copilot CLI homes", () => {
  const claudeTarget = setupGlobals.TARGETS.find(
    (target) => target.name === "Claude Code",
  );
  const copilotTarget = setupGlobals.TARGETS.find(
    (target) => target.name === "Copilot CLI",
  );

  assert.equal(
    claudeTarget.targetDir,
    path.join(require("node:os").homedir(), ".claude"),
  );
  assert.equal(
    copilotTarget.targetDir,
    path.join(require("node:os").homedir(), ".copilot"),
  );
});

test("VS Code Copilot targets the user Code directory", () => {
  const vscodeUserDir = setupGlobals.getVscodeUserDir();

  if (process.platform === "win32") {
    assert.equal(vscodeUserDir, path.join(process.env.APPDATA, "Code", "User"));
    return;
  }

  assert.equal(
    vscodeUserDir,
    path.join(require("node:os").homedir(), ".config", "Code", "User"),
  );
});

test("parseArgs supports skills-only and skip-skills modes", () => {
  assert.deepEqual(setupGlobals.parseArgs([]), {
    skipSkills: false,
    skillsOnly: false,
  });

  assert.deepEqual(setupGlobals.parseArgs(["--skills-only"]), {
    skipSkills: false,
    skillsOnly: true,
  });

  assert.deepEqual(setupGlobals.parseArgs(["--skip-skills"]), {
    skipSkills: true,
    skillsOnly: false,
  });
});

test("parseArgs rejects incompatible flag combinations", () => {
  assert.throws(
    () => setupGlobals.parseArgs(["--skills-only", "--skip-skills"]),
    /cannot be used together/,
  );
});

test("installCuratedSkills runs npx skills add for each curated skill", () => {
  const spawnCalls = [];
  const logMessages = [];

  setupGlobals.installCuratedSkills({
    spawnSync(command, args, options) {
      spawnCalls.push({ command, args, options });
      return { status: 0 };
    },
    log(message = "") {
      logMessages.push(message);
    },
  });

  assert.equal(spawnCalls.length, setupGlobals.CURATED_SKILLS.length);

  for (const [index, skill] of setupGlobals.CURATED_SKILLS.entries()) {
    const call = spawnCalls[index];

    assert.equal(call.command, "npx");
    assert.deepEqual(call.args, [
      "skills",
      "add",
      skill,
      "-g",
      "-a",
      setupGlobals.CURATED_SKILL_AGENTS[0],
      "-a",
      setupGlobals.CURATED_SKILL_AGENTS[1],
      "-y",
    ]);
    assert.equal(call.options.stdio, "inherit");
    assert.equal(call.options.cwd, path.resolve(__dirname, "..", ".."));
  }

  assert.match(logMessages[0], /Installing skill:/);
  assert.equal(
    logMessages.at(-2),
    "Installed curated skills for: claude-code, github-copilot",
  );
  assert.match(logMessages.at(-1), /Eraser also offers an MCP server/);
});

test("installCuratedSkills surfaces failing skill installs", () => {
  assert.throws(
    () =>
      setupGlobals.installCuratedSkills({
        spawnSync() {
          return { status: 1 };
        },
        log() {},
      }),
    /Skill installation failed for https:\/\/github.com\/blader\/humanizer/,
  );
});

test("listInstalledSkills reads installed skills via npx skills list", () => {
  const installedSkills = setupGlobals.listInstalledSkills({
    spawnSync(command, args, options) {
      assert.equal(command, "npx");
      assert.deepEqual(args, ["skills", "list", "-g", "--json"]);
      assert.equal(options.encoding, "utf8");
      assert.equal(options.cwd, path.resolve(__dirname, "..", ".."));

      return {
        status: 0,
        stdout: JSON.stringify([
          {
            name: "humanizer",
            scope: "global",
            agents: ["Claude Code", "GitHub Copilot"],
          },
        ]),
      };
    },
  });

  assert.deepEqual(installedSkills, [
    {
      name: "humanizer",
      scope: "global",
      agents: ["Claude Code", "GitHub Copilot"],
    },
  ]);
});

test("isSkillInstalledForAgents matches skills CLI agent names", () => {
  const installedSkills = [
    {
      name: "humanizer",
      scope: "global",
      agents: ["Claude Code", "GitHub Copilot"],
    },
    {
      name: "form-analyzer",
      scope: "global",
      agents: ["GitHub Copilot"],
    },
  ];

  assert.equal(
    setupGlobals.isSkillInstalledForAgents(
      installedSkills,
      "humanizer",
      setupGlobals.CURATED_SKILL_AGENTS,
    ),
    true,
  );

  assert.equal(
    setupGlobals.isSkillInstalledForAgents(
      installedSkills,
      "form-analyzer",
      setupGlobals.CURATED_SKILL_AGENTS,
    ),
    false,
  );
});

test(
  "installed curated skills are present when live skills assertions are enabled",
  {
    skip: process.env.RUN_LIVE_SKILLS_ASSERTIONS !== "1",
  },
  () => {
    const installedSkills = setupGlobals.listInstalledSkills();

    assert.equal(
      setupGlobals.isSkillInstalledForAgents(
        installedSkills,
        "humanizer",
        setupGlobals.CURATED_SKILL_AGENTS,
      ),
      true,
    );

    assert.equal(
      setupGlobals.isSkillInstalledForAgents(
        installedSkills,
        "eraser",
        setupGlobals.CURATED_SKILL_AGENTS,
      ),
      true,
    );
  },
);
