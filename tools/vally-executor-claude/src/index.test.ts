import { EventEmitter } from "node:events";
import { jest, describe, expect, test } from "@jest/globals";

const spawnMock = jest.fn();
const childProcessModule = await import("node:child_process");
jest.unstable_mockModule("node:child_process", () => ({
  ...childProcessModule,
  spawn: spawnMock,
}));

const { ClaudeCliExecutor, resolveClaudeProvider } = await import("./index.js");

function createChildProcess() {
  const child = new EventEmitter() as EventEmitter & {
    killed: boolean;
    kill: () => void;
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  child.killed = false;
  child.kill = () => {
    child.killed = true;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  return child;
}

describe("resolveClaudeProvider", () => {
  test("uses process environment variable named by apiKeyEnv", () => {
    expect(
      resolveClaudeProvider(
        {
          apiKeyEnv: "TEST_ANTHROPIC_KEY",
          baseUrl: "https://provider.example/v1",
        },
        { TEST_ANTHROPIC_KEY: "test-key" },
      ),
    ).toEqual({
      apiKey: "test-key",
      bearerToken: undefined,
      baseUrl: "https://provider.example/v1",
    });
  });

  test("bearerTokenEnv takes precedence over apiKeyEnv", () => {
    expect(
      resolveClaudeProvider(
        { apiKeyEnv: "TEST_API_KEY", bearerTokenEnv: "TEST_BEARER_TOKEN" },
        { TEST_API_KEY: "ignored-key", TEST_BEARER_TOKEN: "bearer-token" },
      ),
    ).toEqual({
      apiKey: undefined,
      bearerToken: "bearer-token",
      baseUrl: undefined,
    });
  });

  test("fails when configured credential environment variable is unset", () => {
    expect(() =>
      resolveClaudeProvider({ apiKeyEnv: "MISSING_ANTHROPIC_KEY" }, {}),
    ).toThrow("MISSING_ANTHROPIC_KEY");
  });

  test("does not read credentials from agent environment values", () => {
    expect(() =>
      resolveClaudeProvider({ apiKeyEnv: "AGENT_ONLY_KEY" }, {}),
    ).toThrow("AGENT_ONLY_KEY");
  });
});

describe("ClaudeCliExecutor provider config", () => {
  test("accepts Vally-style provider environment references", () => {
    expect(() =>
      new ClaudeCliExecutor().validateConfig({
        provider: {
          baseUrl: "http://localhost:11434/v1",
          apiKeyEnv: "OLLAMA_KEY",
        },
      }),
    ).not.toThrow();
  });

  test("rejects literal credential and dotenv configuration", () => {
    expect(() =>
      new ClaudeCliExecutor().validateConfig({ apiKey: "literal-secret" }),
    ).toThrow("Unsupported claude-cli executor config key: apiKey");
    expect(() =>
      new ClaudeCliExecutor().validateConfig({ dotenvPath: ".env" }),
    ).toThrow("Unsupported claude-cli executor config key: dotenvPath");
  });

  test.each([
    ["provider", null, "claude-cli config.provider must be an object"],
    ["permissionMode", 42, "claude-cli config.permissionMode must be a string"],
    [
      "allowDangerouslySkipPermissions",
      "true",
      "claude-cli config.allowDangerouslySkipPermissions must be a boolean",
    ],
    [
      "maxBudgetUsd",
      0,
      "claude-cli config.maxBudgetUsd must be a positive number",
    ],
    [
      "extraArgs",
      ["ok", 42],
      "claude-cli config.extraArgs must be an array of strings",
    ],
  ])("rejects invalid %s configuration", (key, value, message) => {
    expect(() =>
      new ClaudeCliExecutor().validateConfig({ [key]: value }),
    ).toThrow(message);
  });

  test("rejects invalid provider fields", () => {
    expect(() =>
      new ClaudeCliExecutor().validateConfig({
        provider: { unknown: "value" },
      }),
    ).toThrow("Unsupported claude-cli provider config key: unknown");
    expect(() =>
      new ClaudeCliExecutor().validateConfig({ provider: { apiKeyEnv: 42 } }),
    ).toThrow("claude-cli provider.apiKeyEnv must be a string");
  });

  test("passes process environment values and model to Claude CLI", async () => {
    const child = createChildProcess();
    spawnMock.mockImplementationOnce((...callArgs: any[]) => {
      const options = callArgs[2];
      queueMicrotask(() => {
        options.env.TEST_SENTINEL = "visible";
        child.stdout.emit(
          "data",
          Buffer.from(JSON.stringify({ result: "done" }) + "\n"),
        );
        child.emit("close", 0);
      });
      return child;
    });

    const trajectory = await new ClaudeCliExecutor().execute(
      { prompt: "hello" } as any,
      {
        timeout: 1000,
        executorConfig: {},
        env: {
          ANTHROPIC_API_KEY: "env-key",
          ANTHROPIC_BASE_URL: "https://env.example/v1",
          ANTHROPIC_MODEL: "env-model",
        },
      } as any,
    );

    const [, args, options] = spawnMock.mock.calls.at(-1)! as any[];
    expect(args).toContain("env-model");
    expect(options.env).toMatchObject({
      ANTHROPIC_API_KEY: "env-key",
      ANTHROPIC_BASE_URL: "https://env.example/v1",
      ANTHROPIC_MODEL: "env-model",
    });
    expect(trajectory.metadata.model).toBe("env-model");
  });

  test("explicit model overrides ANTHROPIC_MODEL", async () => {
    const child = createChildProcess();
    spawnMock.mockImplementationOnce(() => {
      queueMicrotask(() => child.emit("close", 0));
      return child;
    });

    const trajectory = await new ClaudeCliExecutor().execute(
      { prompt: "hello" } as any,
      {
        timeout: 1000,
        model: "explicit-model",
        executorConfig: {},
        env: { ANTHROPIC_MODEL: "env-model" },
      } as any,
    );

    const [, args] = spawnMock.mock.calls.at(-1)! as any[];
    expect(args).toContain("explicit-model");
    expect(trajectory.metadata.model).toBe("explicit-model");
  });

  test("bearer provider removes inherited API key from Claude child environment", async () => {
    const child = createChildProcess();
    process.env.TEST_BEARER_TOKEN = "bearer-token";
    process.env.ANTHROPIC_API_KEY = "inherited-key";
    spawnMock.mockImplementationOnce(() => {
      queueMicrotask(() => child.emit("close", 0));
      return child;
    });

    try {
      await new ClaudeCliExecutor().execute(
        { prompt: "hello" } as any,
        {
          timeout: 1000,
          executorConfig: {
            provider: { bearerTokenEnv: "TEST_BEARER_TOKEN" },
          },
        } as any,
      );
      const [, , options] = spawnMock.mock.calls.at(-1)! as any[];
      expect(options.env.ANTHROPIC_AUTH_TOKEN).toBe("bearer-token");
      expect(options.env.ANTHROPIC_API_KEY).toBeUndefined();
    } finally {
      delete process.env.TEST_BEARER_TOKEN;
      delete process.env.ANTHROPIC_API_KEY;
    }
  });
});
