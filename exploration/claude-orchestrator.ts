/**
 * Simple Claude Code Orchestration POC
 *
 * This demonstrates the basic control protocol communication with Claude Code CLI.
 * Based on the implementation in crates/executors/src/executors/claude/
 */

import { spawn } from "child_process";
import * as readline from "readline";
import { randomUUID } from "crypto";

// Types based on the control protocol
interface ControlRequest {
  type: "control_request";
  request_id: string;
  request: {
    subtype: string;
    [key: string]: any;
  };
}

interface ControlResponse {
  type: "control_response";
  response: {
    subtype: "success" | "error";
    request_id: string;
    response?: any;
    error?: string;
  };
}

interface UserMessage {
  type: "user";
  message: {
    role: "user";
    content: string;
  };
}

class ClaudeCodeOrchestrator {
  private stdin: NodeJS.WritableStream | null = null;
  private autoApprove: boolean;

  constructor(autoApprove: boolean = true) {
    this.autoApprove = autoApprove;
  }

  async execute(
    prompt: string,
    workingDir: string = process.cwd(),
  ): Promise<void> {
    console.log("🚀 Starting Claude Code orchestration...\n");

    // Build command with required flags
    const args = [
      "-y",
      "@anthropic-ai/claude-code@2.1.41",
      "-p",
      "--verbose",
      "--output-format=stream-json",
      "--input-format=stream-json",
      "--include-partial-messages",
      "--replay-user-messages",
      "--permission-mode=bypassPermissions",
    ];

    const child = spawn("npx", args, {
      cwd: workingDir,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, NPM_CONFIG_LOGLEVEL: "error" },
    });

    this.stdin = child.stdin;

    // Set up stdout reader
    const rl = readline.createInterface({
      input: child.stdout,
      crlfDelay: Infinity,
    });

    // Handle stdout lines
    rl.on("line", async line => {
      if (!line.trim()) return;

      console.log("📥", line);

      try {
        const message = JSON.parse(line);

        // Handle control requests from CLI
        if (message.type === "control_request") {
          await this.handleControlRequest(message as ControlRequest);
        }

        // Exit on result message
        if (message.type === "result") {
          console.log("\n✅ Execution completed");
          child.kill();
        }
      } catch (e) {
        // Not JSON or parsing error, continue
      }
    });

    // Handle stderr
    child.stderr.on("data", data => {
      const msg = data.toString();
      if (!msg.includes("[WARN] Fast mode requires")) {
        console.error("⚠️ ", msg);
      }
    });

    // Handle process exit
    child.on("exit", code => {
      console.log(`\n🏁 Process exited with code ${code}`);
      process.exit(code ?? 0);
    });

    // Initialize control protocol
    await this.sendInitialize();

    // Send the user prompt
    await this.sendUserMessage(prompt);
  }

  private async sendInitialize(): Promise<void> {
    const initMessage = {
      type: "control_request",
      request_id: randomUUID(),
      request: {
        subtype: "initialize",
        hooks: null,
      },
    };

    await this.writeJson(initMessage);
    console.log("📤 Sent initialize");
  }

  private async sendUserMessage(content: string): Promise<void> {
    const userMessage: UserMessage = {
      type: "user",
      message: {
        role: "user",
        content,
      },
    };

    await this.writeJson(userMessage);
    console.log(`📤 Sent user message: "${content.substring(0, 50)}..."\n`);
  }

  private async handleControlRequest(request: ControlRequest): Promise<void> {
    const { request_id, request: req } = request;

    if (req.subtype === "can_use_tool") {
      // Auto-approve tool usage
      const response: ControlResponse = {
        type: "control_response",
        response: {
          subtype: "success",
          request_id,
          response: {
            behavior: "allow",
            updatedInput: req.input,
            updatedPermissions: null,
          },
        },
      };

      await this.writeJson(response);
      console.log(`✓ Auto-approved tool: ${req.tool_name}`);
    } else if (req.subtype === "hook_callback") {
      // Handle hook callbacks
      const response: ControlResponse = {
        type: "control_response",
        response: {
          subtype: "success",
          request_id,
          response: {
            hookSpecificOutput: {
              hookEventName: "PreToolUse",
              permissionDecision: "allow",
              permissionDecisionReason: "Auto-approved by POC",
            },
          },
        },
      };

      await this.writeJson(response);
      console.log(`✓ Handled hook callback: ${req.callback_id}`);
    }
  }

  private async writeJson(obj: any): Promise<void> {
    if (!this.stdin) throw new Error("stdin not available");

    const json = JSON.stringify(obj) + "\n";
    this.stdin.write(json);
  }
}

// Main execution
const main = async () => {
  const prompt =
    process.argv[2] ||
    'Create a file called hello.txt with the text "Hello, World!"';
  const orchestrator = new ClaudeCodeOrchestrator(true);

  await orchestrator.execute(prompt);
};

main().catch(console.error);
