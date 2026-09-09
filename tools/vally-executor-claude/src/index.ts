import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import type {
  Executor,
  ExecutorOptions,
  ExecutorRegistry,
  Stimulus,
  Trajectory,
  TrajectoryEvent,
} from "@microsoft/vally";
import { computeMetrics } from "@microsoft/vally";

interface ClaudeExecutorConfig {
  command?: string;
  provider?: ClaudeProviderConfig;
  permissionMode?: string;
  allowDangerouslySkipPermissions?: boolean;
  maxBudgetUsd?: number;
  extraArgs?: string[];
}

interface ClaudeProviderConfig {
  baseUrl?: string;
  apiKeyEnv?: string;
  bearerTokenEnv?: string;
}

export interface ClaudeProviderSettings {
  apiKey?: string;
  bearerToken?: string;
  baseUrl?: string;
}

export function resolveClaudeProvider(
  config: ClaudeProviderConfig = {},
  env: NodeJS.ProcessEnv = process.env,
): ClaudeProviderSettings {
  const tokenEnv = config.bearerTokenEnv ?? config.apiKeyEnv;
  const token = tokenEnv ? env[tokenEnv] : undefined;
  if (tokenEnv && !token)
    throw new Error(
      `Claude provider environment variable is unset: ${tokenEnv}`,
    );

  return {
    apiKey: config.bearerTokenEnv ? undefined : token,
    bearerToken: config.bearerTokenEnv ? token : undefined,
    baseUrl: config.baseUrl,
  };
}

interface ClaudeMessage {
  type?: string;
  session_id?: string;
  result?: string;
  message?: { content?: unknown };
  content?: unknown;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

export class ClaudeCliExecutor implements Executor {
  readonly name = "claude-cli";
  readonly supportsEnvVars = true;
  readonly supportsPreparedWorkspace = false;
  readonly supportsMultiTurn = false;

  validateConfig(config: unknown): void {
    if (config === undefined) return;
    if (typeof config !== "object" || config === null || Array.isArray(config))
      throw new Error("claude-cli executor config must be an object");

    const value = config as Record<string, unknown>;
    const supported = [
      "command",
      "provider",
      "permissionMode",
      "allowDangerouslySkipPermissions",
      "maxBudgetUsd",
      "extraArgs",
    ];
    for (const key of Object.keys(value)) {
      if (!supported.includes(key))
        throw new Error(`Unsupported claude-cli executor config key: ${key}`);
    }
    if (value.command !== undefined && typeof value.command !== "string")
      throw new Error("claude-cli config.command must be a string");
    if (
      value.provider !== undefined &&
      (typeof value.provider !== "object" ||
        value.provider === null ||
        Array.isArray(value.provider))
    ) {
      throw new Error("claude-cli config.provider must be an object");
    }
    if (value.provider !== undefined) {
      const provider = value.provider as Record<string, unknown>;
      for (const key of Object.keys(provider)) {
        if (!["baseUrl", "apiKeyEnv", "bearerTokenEnv"].includes(key))
          throw new Error(`Unsupported claude-cli provider config key: ${key}`);
        if (typeof provider[key] !== "string")
          throw new Error(`claude-cli provider.${key} must be a string`);
      }
    }
    if (
      value.permissionMode !== undefined &&
      typeof value.permissionMode !== "string"
    )
      throw new Error("claude-cli config.permissionMode must be a string");
    if (
      value.allowDangerouslySkipPermissions !== undefined &&
      typeof value.allowDangerouslySkipPermissions !== "boolean"
    )
      throw new Error(
        "claude-cli config.allowDangerouslySkipPermissions must be a boolean",
      );
    if (
      value.maxBudgetUsd !== undefined &&
      (typeof value.maxBudgetUsd !== "number" || value.maxBudgetUsd <= 0)
    )
      throw new Error(
        "claude-cli config.maxBudgetUsd must be a positive number",
      );
    if (
      value.extraArgs !== undefined &&
      (!Array.isArray(value.extraArgs) ||
        value.extraArgs.some((arg) => typeof arg !== "string"))
    )
      throw new Error(
        "claude-cli config.extraArgs must be an array of strings",
      );
  }

  async execute(
    stimulus: Stimulus,
    options: ExecutorOptions,
  ): Promise<Trajectory> {
    if (stimulus.turns && stimulus.turns.length > 1)
      throw new Error(
        "claude-cli executor currently supports one prompt per stimulus",
      );

    const startedAt = new Date();
    const events: TrajectoryEvent[] = [];
    const sessionId = options.sessionID ?? randomUUID();
    const turnId = randomUUID();
    const prompt = stimulus.prompt ?? stimulus.turns?.[0] ?? "";
    const config = (options.executorConfig ?? {}) as ClaudeExecutorConfig;
    const provider = resolveClaudeProvider(config.provider);
    const childEnv = { ...process.env, ...(options.env ?? {}) };
    const model = options.model ?? childEnv.ANTHROPIC_MODEL ?? "sonnet";
    if (provider.apiKey) childEnv.ANTHROPIC_API_KEY = provider.apiKey;
    if (provider.bearerToken) {
      delete childEnv.ANTHROPIC_API_KEY;
      childEnv.ANTHROPIC_AUTH_TOKEN = provider.bearerToken;
    }
    if (provider.baseUrl) childEnv.ANTHROPIC_BASE_URL = provider.baseUrl;
    const mcpConfigPath = options.mcpServers
      ? await this.writeMcpConfig(options.mcpServers)
      : undefined;
    const toolNames = new Map<string, string>();

    events.push({
      type: "user_message",
      timestamp: startedAt,
      data: { content: prompt },
    });
    events.push({ type: "turn_start", timestamp: startedAt, data: { turnId } });
    for (const skill of options.skills ?? []) {
      events.push({
        type: "skill_activation",
        timestamp: startedAt,
        data: {
          name: skill.name,
          path: skill.path ?? skill.name,
          content: skill.rawContent,
        },
      });
    }

    const args = [
      "--print",
      "--verbose",
      "--output-format",
      "stream-json",
      "--model",
      model,
      "--permission-mode",
      config.permissionMode ?? "acceptEdits",
      "--session-id",
      sessionId,
      "--no-session-persistence",
    ];
    if (config.allowDangerouslySkipPermissions)
      args.push(
        "--allow-dangerously-skip-permissions",
        "--dangerously-skip-permissions",
      );
    if (config.maxBudgetUsd !== undefined)
      args.push("--max-budget-usd", String(config.maxBudgetUsd));
    if (mcpConfigPath)
      args.push("--mcp-config", mcpConfigPath, "--strict-mcp-config");
    args.push(...(config.extraArgs ?? []), prompt);

    let output = "";
    let resultSessionId = sessionId;
    let timedOut = false;
    let child: ChildProcess | undefined;

    try {
      child = spawn(config.command ?? "claude", args, {
        cwd: options.workDir,
        env: childEnv,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      const stderr: string[] = [];
      child.stderr?.on("data", (chunk: Buffer) =>
        stderr.push(chunk.toString()),
      );
      const deadline = Math.min(
        options.timeout,
        options.maxAgentDurationMs ?? options.timeout,
      );
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (error?: Error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          error ? reject(error) : resolve();
        };
        const timer = setTimeout(() => {
          timedOut = true;
          child?.kill();
          finish();
        }, deadline);
        child?.on("error", (error) => finish(error));
        child?.on("close", (code) => {
          if (code !== null && code !== 0 && !timedOut && stderr.length > 0)
            events.push({
              type: "error",
              timestamp: new Date(),
              data: { message: stderr.join(""), code },
            });
          finish();
        });
        child?.stdout?.on("data", (chunk: Buffer) => {
          const text = chunk.toString();
          output += text;
          for (const line of text.split(/\r?\n/)) {
            this.consumeMessage(
              line,
              events,
              turnId,
              (id) => {
                resultSessionId = id;
              },
              options,
              model,
              toolNames,
            );
          }
        });
      });
    } finally {
      if (child && !child.killed) child.kill();
      if (mcpConfigPath) await rm(mcpConfigPath, { force: true });
    }

    const completedAt = new Date();
    events.push({ type: "turn_end", timestamp: completedAt, data: { turnId } });
    return {
      id: randomUUID(),
      stimulus,
      events,
      output: this.extractOutput(output),
      workDir: options.workDir,
      metadata: {
        startedAt,
        completedAt,
        model,
        executor: this.name,
        skillsLoaded: (options.skills ?? []).map((skill) => skill.name),
        sessionID: resultSessionId,
      },
      metrics: computeMetrics(events),
      endReason: timedOut ? "agent_timeout" : "completed",
      artifactDir: options.sessionLog?.executorArtifactsDir,
    };
  }

  async shutdown(): Promise<void> {}

  private async writeMcpConfig(
    servers: NonNullable<ExecutorOptions["mcpServers"]>,
  ): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), "vally-claude-"));
    const path = join(directory, "mcp.json");
    await writeFile(path, JSON.stringify({ mcpServers: servers }), "utf8");
    return path;
  }

  private consumeMessage(
    line: string,
    events: TrajectoryEvent[],
    turnId: string,
    setSessionId: (id: string) => void,
    options: ExecutorOptions,
    model: string,
    toolNames: Map<string, string>,
  ): void {
    if (!line.trim()) return;
    let message: ClaudeMessage;
    try {
      message = JSON.parse(line) as ClaudeMessage;
    } catch {
      return;
    }
    options.onRawEvent?.(message);
    if (message.session_id) setSessionId(message.session_id);
    const content = message.message?.content ?? message.content;
    if (Array.isArray(content)) {
      for (const block of content) {
        if (!block || typeof block !== "object") continue;
        const item = block as Record<string, unknown>;
        if (item.type === "text" && typeof item.text === "string") {
          events.push({
            type: "assistant_message",
            timestamp: new Date(),
            data: { content: item.text },
          });
        } else if (
          item.type === "thinking" &&
          typeof item.thinking === "string"
        ) {
          events.push({
            type: "reasoning",
            timestamp: new Date(),
            data: { content: item.thinking },
          });
        } else if (item.type === "tool_use" && typeof item.name === "string") {
          const toolCallId = String(item.id ?? randomUUID());
          toolNames.set(toolCallId, item.name);
          events.push({
            type: "tool_call",
            timestamp: new Date(),
            data: {
              toolName: item.name,
              toolCallId,
              turnId,
              arguments: (item.input as Record<string, unknown>) ?? {},
            },
          });
        } else if (item.type === "tool_result") {
          const toolCallId = String(item.tool_use_id ?? randomUUID());
          events.push({
            type: "tool_result",
            timestamp: new Date(),
            data: {
              toolName:
                toolNames.get(toolCallId) ?? String(item.name ?? "tool"),
              toolCallId,
              success: !Boolean(item.is_error),
              result: item.content,
            },
          });
        }
      }
    }
    if (message.usage) {
      events.push({
        type: "token_usage",
        timestamp: new Date(),
        data: {
          inputTokens: message.usage.input_tokens ?? 0,
          outputTokens: message.usage.output_tokens ?? 0,
          cacheReadTokens: message.usage.cache_read_input_tokens,
          cacheWriteTokens: message.usage.cache_creation_input_tokens,
          model,
        },
      });
    }
    if (message.type === "result" && typeof message.result === "string")
      events.push({
        type: "assistant_message",
        timestamp: new Date(),
        data: { content: message.result },
      });
  }

  private extractOutput(raw: string): string {
    const results: string[] = [];
    for (const line of raw.split(/\r?\n/)) {
      try {
        const message = JSON.parse(line) as ClaudeMessage;
        if (message.type === "result" && typeof message.result === "string")
          results.push(message.result);
      } catch {
        /* Ignore non-JSON diagnostics from Claude. */
      }
    }
    return results.at(-1) ?? raw.trim();
  }
}

export function registerExecutors(registry: ExecutorRegistry): void {
  registry.register(new ClaudeCliExecutor());
}
