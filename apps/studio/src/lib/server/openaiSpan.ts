import type { Severity, TraceEvent, TraceRun, ViolationType } from "@agent-breach/trace-schema";

/**
 * Converts OpenAI Agents SDK / OpenInference trace spans into a Cordon TraceRun
 * so they can be replayed and re-run through the detectors. Returns null when
 * the payload is not an OpenInference span (callers then use it as-is).
 */
export function coerceOpenInferenceTrace(input: unknown): TraceRun | null {
  const spans = Array.isArray(input) ? input : [input];

  if (spans.length === 0 || !spans.every(isOpenInferenceSpan)) {
    return null;
  }

  return spansToRun(spans);
}

export function isOpenInferenceSpan(value: unknown): value is OpenInferenceSpan {
  if (!isRecord(value)) {
    return false;
  }

  const attributes = value.attributes;
  const hasKind = isRecord(attributes) && typeof attributes["openinference.span.kind"] === "string";
  const hasTraceContext = isRecord(value.context) && typeof value.context.trace_id === "string";

  return hasKind || (hasTraceContext && isRecord(attributes));
}

interface OpenInferenceSpan {
  name?: unknown;
  context?: unknown;
  attributes?: unknown;
  start_time?: unknown;
  end_time?: unknown;
}

function spansToRun(spans: OpenInferenceSpan[]): TraceRun {
  const first = spans[0]!;
  const firstAttrs = asRecord(first.attributes);
  const traceId = asString(asRecord(first.context)?.trace_id) ?? asString(asRecord(first.context)?.span_id) ?? "openai";
  const model = asString(firstAttrs?.["llm.model_name"]) ?? "openai-agent";
  const runId = `run_openai_${slug(traceId)}`;

  const startedAt = toIso(first.start_time) ?? new Date().toISOString();
  const endedAt = toIso(spans[spans.length - 1]?.end_time) ?? startedAt;

  const events: TraceEvent[] = [
    {
      id: "evt_start",
      runId,
      type: "trace.start",
      timestamp: startedAt,
      actor: { id: "openai-agents", type: "agent", name: "OpenAI Agents SDK" },
      summary: "Imported OpenAI Agents SDK trace span.",
      captureMode: "redacted-preview",
    },
  ];

  let blocked = false;
  let counter = 0;

  for (const span of spans) {
    const attrs = asRecord(span.attributes) ?? {};
    const spanModel = asString(attrs["llm.model_name"]) ?? model;
    const timestamp = toIso(span.start_time) ?? startedAt;
    const prefix = `s${counter}`;
    counter += 1;

    const inputValue = asString(attrs["input.value"]);
    const outputValue = asString(attrs["output.value"]);
    const threat = asString(attrs["safety.threat_category"]) ?? "prompt_injection";
    const isViolation = attrs["safety.policy_violation"] === true;
    const status = asString(attrs["agent.execution_status"]) ?? "";
    const spanBlocked = isViolation || /block|deny|reject/i.test(status) || /block|denied|refus/i.test(outputValue ?? "");

    const sourceId = `${prefix}_src`;
    events.push({
      id: sourceId,
      runId,
      type: "source.read",
      timestamp,
      actor: { id: "input", type: "user", name: "Agent input" },
      summary: "Agent received an untrusted input flagged by the guardrail.",
      source: {
        id: sourceId,
        kind: "user",
        label: "Agent input",
        trust: "untrusted",
        dataClass: "internal",
        ...(inputValue ? { preview: inputValue } : {}),
      },
    });

    const modelId = `${prefix}_model`;
    events.push({
      id: modelId,
      runId,
      type: "model.step",
      timestamp,
      actor: { id: "model", type: "agent", name: spanModel },
      summary: `${spanModel} processed the input under guardrails.`,
      step: { label: `${spanModel} step`, influencedBy: [sourceId] },
    });

    if (spanBlocked) {
      blocked = true;
      events.push({
        id: `${prefix}_policy`,
        runId,
        type: "policy.decision",
        timestamp,
        actor: { id: "guardrail", type: "policy", name: "OpenAI guardrail" },
        summary: outputValue ?? "Guardrail blocked the request.",
        decision: "blocked",
        targetEventId: modelId,
        reason: outputValue ?? `Guardrail blocked a ${threat} attempt.`,
      });

      const violationType = threatToViolation(threat, inputValue);
      events.push({
        id: `${prefix}_violation`,
        runId,
        type: "violation.detected",
        timestamp,
        actor: { id: "detector", type: "detector", name: "Cordon detector" },
        summary: `${violationType} detected in OpenAI Agents run.`,
        violation: {
          type: violationType,
          severity: severityFor(violationType),
          evidenceEventIds: [sourceId, modelId],
          recommendation: recommendationFor(violationType),
        },
      });
    }
  }

  events.push({
    id: "evt_end",
    runId,
    type: "trace.end",
    timestamp: endedAt,
    actor: { id: "openai-agents", type: "agent", name: "OpenAI Agents SDK" },
    summary: `Imported trace ${blocked ? "blocked" : "completed"}.`,
    outcome: blocked ? "blocked" : "completed",
  });

  return {
    id: runId,
    app: `OpenAI Agents (${model})`,
    agent: model,
    captureMode: "redacted-preview",
    startedAt,
    endedAt,
    metadata: { source: "openai-agents-sdk", trace_id: traceId, model, spans: spans.length },
    events,
  };
}

function threatToViolation(threat: string, inputValue: string | undefined): ViolationType {
  const haystack = `${threat} ${inputValue ?? ""}`.toLowerCase();

  if (/exfiltrat|data.?leak|leak|steal/.test(haystack)) {
    return "exfiltration";
  }

  if (/format|wipe|delete|destroy|drop|erase|rm\s/.test(haystack)) {
    return "destructive_write";
  }

  if (/deputy|privileg|impersonat/.test(haystack)) {
    return "confused_deputy";
  }

  return "untrusted_to_action";
}

function severityFor(type: ViolationType): Severity {
  return type === "exfiltration" || type === "destructive_write" ? "critical" : "high";
}

function recommendationFor(type: ViolationType): string {
  const recommendations: Record<ViolationType, string> = {
    exfiltration: "Require approval before external sends that combine untrusted influence with protected data.",
    untrusted_to_action: "Keep the guardrail enforced and label injected instructions as data, never authority.",
    confused_deputy: "Bind privileged actions to trusted user intent before using agent authority.",
    destructive_write: "Require approval before destructive tools requested by untrusted input.",
  };

  return recommendations[type];
}

function toIso(value: unknown): string | undefined {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  // OpenInference emits nanoseconds; fall back to ms / s by magnitude.
  const ms = value > 1e15 ? value / 1e6 : value > 1e12 ? value : value * 1000;
  return new Date(Math.round(ms)).toISOString();
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/^0x/, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "openai";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
