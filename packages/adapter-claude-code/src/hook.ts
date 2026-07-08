import { evaluateToolRisk, sendReplayTrace } from "@agent-breach/trace-sdk-ts";
import type { ViolationType } from "@agent-breach/trace-schema";
import { classifyTool } from "./classify.js";
import type { AdapterConfig } from "./config.js";
import { SessionTrace } from "./session.js";

export interface HookInput {
  session_id?: string;
  hook_event_name?: string;
  tool_name?: string;
  tool_input?: unknown;
  tool_response?: unknown;
}

export interface HookResult {
  block: boolean;
  reason?: string;
  message?: string;
  runId?: string;
}

/**
 * Handles one Claude Code hook event: classifies the tool, updates the session
 * trace, evaluates untrusted-to-action risk, and returns a block decision.
 */
export async function handleHook(input: HookInput, config: AdapterConfig): Promise<HookResult> {
  const sessionId = input.session_id?.trim() || "default";
  const event = (input.hook_event_name ?? "").toLowerCase();

  if (event.includes("stop")) {
    const trace = SessionTrace.load(sessionId, config);
    trace.finalize();
    trace.save();
    await upload(trace, config);
    return { block: false, runId: trace.runId };
  }

  if (!event.startsWith("pretooluse")) {
    return { block: false };
  }

  const classification = classifyTool(input.tool_name ?? "", input.tool_input, config);
  if (classification.kind === "ignore") {
    return { block: false };
  }

  const trace = SessionTrace.load(sessionId, config);

  if (classification.kind === "source") {
    trace.addSource(classification.source);
    trace.save();
    await upload(trace, config);
    return { block: false, runId: trace.runId };
  }

  if (classification.kind === "protected-read") {
    trace.addToolCall(classification.tool, [...trace.untrustedSourceIds], protectedReadSummary(classification.tool.target));
    trace.save();
    await upload(trace, config);
    return { block: false, runId: trace.runId };
  }

  const tool = classification.tool;
  const influencedBy = [...trace.untrustedSourceIds, ...trace.protectedReadIds];
  const toolEventId = trace.addToolCall(tool, influencedBy, actionSummary(tool.name, tool.target));

  const assessment = evaluateToolRisk({
    name: tool.name,
    boundary: tool.boundary,
    target: tool.target,
    targetClass: tool.targetClass,
    influencedBy,
    sourceTrustById: trace.sourceTrust,
    priorToolTargetClassById: trace.priorToolTargetClass,
    ...(tool.destinationClass ? { destinationClass: tool.destinationClass } : {}),
    ...(tool.authority ? { authority: tool.authority } : {}),
  });

  if (assessment.decision === "allowed") {
    trace.save();
    await upload(trace, config);
    return { block: false, runId: trace.runId };
  }

  const willBlock = config.enforce && assessment.shouldBlock;
  trace.addPolicyDecision(toolEventId, willBlock ? "blocked" : assessment.decision, assessment.reason);

  if (willBlock && assessment.violationType && assessment.severity) {
    trace.addViolation(assessment.violationType, assessment.severity, [...influencedBy, toolEventId], recommendationFor(assessment.violationType));
  }

  trace.save();
  await upload(trace, config);

  if (!willBlock) {
    return {
      block: false,
      runId: trace.runId,
      message: `[agent-breach] observed ${assessment.violationType ?? "risk"}: ${assessment.reason} (observe-only)`,
    };
  }

  return {
    block: true,
    runId: trace.runId,
    reason: `Agent Breach blocked ${tool.name} → ${tool.target}. ${assessment.reason} Replay: ${trace.runId}`,
    message: `[agent-breach] BLOCKED ${assessment.violationType}: ${tool.name} → ${tool.target}`,
  };
}

async function upload(trace: SessionTrace, config: AdapterConfig): Promise<void> {
  if (!config.upload) {
    return;
  }

  try {
    await sendReplayTrace(trace.toRun(), {
      endpoint: config.endpoint,
      ...(config.apiKey ? { apiKey: config.apiKey } : {}),
    });
  } catch {
    // Never let an upload failure break the user's Claude Code session.
  }
}

function protectedReadSummary(target: string): string {
  return `Agent read protected data (${target}) while untrusted content was in context.`;
}

function actionSummary(name: string, target: string): string {
  return `Agent attempted ${name} → ${target}.`;
}

function recommendationFor(type: ViolationType): string {
  const recommendations: Record<ViolationType, string> = {
    exfiltration: "Require approval before external sends that combine untrusted influence with protected data.",
    untrusted_to_action: "Spotlight untrusted content and block it from directly authorizing privileged tools.",
    confused_deputy: "Bind privileged actions to trusted user intent before using agent authority.",
    destructive_write: "Require approval for writes, deletes, or mutations influenced by untrusted sources.",
  };

  return recommendations[type];
}
