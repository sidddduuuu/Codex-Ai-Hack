#!/usr/bin/env node
import { loadConfig } from "./config.js";
import { handleHook, type HookInput } from "./hook.js";

/**
 * Claude Code hook entrypoint. Reads the hook event JSON from stdin and, for a
 * PreToolUse block, emits the structured deny decision Claude Code expects.
 * Fails open: any adapter error allows the tool so the session never bricks.
 */
async function main(): Promise<void> {
  const raw = await readStdin();
  let input: HookInput;

  try {
    input = raw.trim() ? (JSON.parse(raw) as HookInput) : {};
  } catch {
    return;
  }

  const config = loadConfig();
  const result = await handleHook(input, config);

  if (result.message) {
    process.stderr.write(`${result.message}\n`);
  }

  if (result.block) {
    process.stdout.write(
      `${JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: result.reason ?? "Blocked by Agent Breach policy.",
        },
      })}\n`,
    );
  }
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(data));
  });
}

main()
  .catch((error) => {
    process.stderr.write(`[agent-breach] adapter error (failing open): ${String(error)}\n`);
  })
  .finally(() => {
    process.exit(0);
  });
