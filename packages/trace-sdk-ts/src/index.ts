import type {
  BaseTraceEvent,
  CaptureMode,
  DataClass,
  DestinationClass,
  PolicyDecision,
  SourceKind,
  ToolBoundary,
  TraceActor,
  TraceEvent,
  TraceRun,
  TrustLevel,
  ViolationType,
  Severity,
} from "@agent-breach/trace-schema";

export interface CreateSecurityTraceOptions {
  app: string;
  agent?: string;
  captureMode?: CaptureMode;
  runId?: string;
  now?: () => Date;
}

export interface SourceInput {
  id: string;
  kind: SourceKind;
  label: string;
  trust: TrustLevel;
  dataClass: DataClass;
  preview?: string;
  contentHash?: string;
  actor?: TraceActor;
}

export interface ModelStepInput {
  label: string;
  summary: string;
  influencedBy: string[];
  plannedTool?: string;
}

export interface ToolCallInput {
  name: string;
  boundary: ToolBoundary;
  target: string;
  targetClass: DataClass;
  destinationClass?: DestinationClass;
  influencedBy: string[];
  authority?: string;
  summary?: string;
}

export interface PolicyDecisionInput {
  targetEventId: string;
  decision: PolicyDecision;
  reason: string;
}

export interface ViolationInput {
  type: ViolationType;
  severity: Severity;
  evidenceEventIds: string[];
  recommendation: string;
}

export interface WrappedToolOptions {
  boundary: ToolBoundary;
  targetClass: DataClass;
  destinationClass?: DestinationClass;
  authority?: string;
  influencedBy?: string[];
  targetFromArgs?: (...args: unknown[]) => string;
  enforce?: boolean;
}

export interface ToolRiskInput extends ToolCallInput {
  sourceTrustById?: ReadonlyMap<string, TrustLevel> | Record<string, TrustLevel>;
  priorToolTargetClassById?: ReadonlyMap<string, DataClass> | Record<string, DataClass>;
}

export interface ToolRiskAssessment {
  decision: PolicyDecision;
  reason: string;
  shouldBlock: boolean;
  violationType?: ViolationType;
  severity?: Severity;
}

export interface SendReplayTraceOptions {
  endpoint?: string;
  apiKey?: string;
  headers?: Record<string, string>;
  fetchImpl?: (input: string, init: RequestInit) => Promise<Response>;
}

export interface TraceUploadResult {
  status: number;
  body: unknown;
  runId?: string;
  eventCount?: number;
}

export function createSecurityTrace(options: CreateSecurityTraceOptions): SecurityTrace {
  return new SecurityTrace(options);
}

export class SecurityPolicyBlockedError extends Error {
  constructor(
    readonly toolName: string,
    readonly target: string,
    readonly assessment: ToolRiskAssessment,
  ) {
    super(`Blocked ${toolName} on ${target}: ${assessment.reason}`);
    this.name = "SecurityPolicyBlockedError";
  }
}

export class TraceUploadError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`Trace upload failed with status ${status}.`);
    this.name = "TraceUploadError";
  }
}

export class SecurityTrace {
  private readonly now: () => Date;
  private readonly runId: string;
  private readonly app: string;
  private readonly agent: string;
  private readonly captureMode: CaptureMode;
  private readonly events: TraceEvent[] = [];
  private readonly sourceTrustById = new Map<string, TrustLevel>();
  private readonly priorToolTargetClassById = new Map<string, DataClass>();
  private counter = 0;
  private endedAt: string | undefined;
  private readonly startedAt: string;

  constructor(options: CreateSecurityTraceOptions) {
    this.now = options.now ?? (() => new Date());
    this.runId = options.runId ?? `run_${cryptoRandomId()}`;
    this.app = options.app;
    this.agent = options.agent ?? "agent";
    this.captureMode = options.captureMode ?? "metadata-only";
    this.startedAt = this.timestamp();

    this.events.push({
      ...this.base("trace.start", "Started security trace.", {
        id: this.agent,
        name: this.agent,
        type: "agent",
      }),
      type: "trace.start",
      captureMode: this.captureMode,
    });
  }

  source(input: SourceInput): string {
    const preview = input.preview ? redactPreview(input.preview, this.captureMode) : undefined;
    const event = {
      ...this.base("source.read", `Read ${input.label}.`, input.actor ?? { id: "source", name: input.kind, type: "tool" }),
      type: "source.read" as const,
      source: {
        id: input.id,
        kind: input.kind,
        label: input.label,
        trust: input.trust,
        dataClass: input.dataClass,
        ...(preview !== undefined ? { preview } : {}),
        ...(input.contentHash ? { contentHash: input.contentHash } : {}),
      },
    };

    this.events.push(event);
    this.sourceTrustById.set(input.id, input.trust);
    return input.id;
  }

  modelStep(input: ModelStepInput): string {
    const event = {
      ...this.base("model.step", input.summary, { id: this.agent, name: this.agent, type: "agent" }),
      type: "model.step" as const,
      step: {
        label: input.label,
        influencedBy: input.influencedBy,
        ...(input.plannedTool ? { plannedTool: input.plannedTool } : {}),
      },
    };

    this.events.push(event);
    return event.id;
  }

  tool(input: ToolCallInput): string {
    const event = {
      ...this.base("tool.call", input.summary ?? `Called ${input.name}.`, {
        id: `tool_${input.name}`,
        name: input.name,
        type: "tool",
      }),
      type: "tool.call" as const,
      tool: {
        name: input.name,
        boundary: input.boundary,
        target: input.target,
        targetClass: input.targetClass,
        influencedBy: input.influencedBy,
        ...(input.destinationClass ? { destinationClass: input.destinationClass } : {}),
        ...(input.authority ? { authority: input.authority } : {}),
      },
    };

    this.events.push(event);
    this.priorToolTargetClassById.set(event.id, input.targetClass);
    return event.id;
  }

  policyDecision(input: PolicyDecisionInput): string {
    const event = {
      ...this.base("policy.decision", input.reason, { id: "policy", name: "Policy", type: "policy" }),
      type: "policy.decision" as const,
      decision: input.decision,
      targetEventId: input.targetEventId,
      reason: input.reason,
    };

    this.events.push(event);
    return event.id;
  }

  violation(input: ViolationInput): string {
    const event = {
      ...this.base("violation.detected", `${input.type} detected.`, {
        id: "detector",
        name: "Detector",
        type: "detector",
      }),
      type: "violation.detected" as const,
      violation: input,
    };

    this.events.push(event);
    return event.id;
  }

  wrapTool<TArgs extends unknown[], TResult>(
    name: string,
    fn: (...args: TArgs) => TResult | Promise<TResult>,
    options: WrappedToolOptions,
  ): (...args: TArgs) => Promise<TResult> {
    return async (...args: TArgs) => {
      const target = options.targetFromArgs?.(...args) ?? name;
      const influencedBy = options.influencedBy ?? [];
      const toolEventId = this.tool({
        name,
        boundary: options.boundary,
        target,
        targetClass: options.targetClass,
        influencedBy,
        ...(options.destinationClass ? { destinationClass: options.destinationClass } : {}),
        ...(options.authority ? { authority: options.authority } : {}),
      });
      const assessment = evaluateToolRisk({
        name,
        boundary: options.boundary,
        target,
        targetClass: options.targetClass,
        influencedBy,
        sourceTrustById: this.sourceTrustById,
        priorToolTargetClassById: this.priorToolTargetClassById,
        ...(options.destinationClass ? { destinationClass: options.destinationClass } : {}),
        ...(options.authority ? { authority: options.authority } : {}),
      });

      if (assessment.decision !== "allowed") {
        this.policyDecision({
          targetEventId: toolEventId,
          decision: options.enforce ? "blocked" : assessment.decision,
          reason: assessment.reason,
        });
      }

      if (options.enforce && assessment.shouldBlock) {
        if (assessment.violationType && assessment.severity) {
          this.violation({
            type: assessment.violationType,
            severity: assessment.severity,
            evidenceEventIds: [...influencedBy, toolEventId],
            recommendation: recommendationFor(assessment.violationType),
          });
        }

        throw new SecurityPolicyBlockedError(name, target, assessment);
      }

      return fn(...args);
    };
  }

  end(outcome: "completed" | "blocked" | "failed" = "completed"): TraceRun {
    this.endedAt = this.timestamp();
    this.events.push({
      ...this.base("trace.end", `Trace ${outcome}.`, { id: this.agent, name: this.agent, type: "agent" }),
      type: "trace.end",
      outcome,
    });

    return this.toReplay();
  }

  toReplay(): TraceRun {
    return {
      id: this.runId,
      app: this.app,
      agent: this.agent,
      captureMode: this.captureMode,
      startedAt: this.startedAt,
      ...(this.endedAt ? { endedAt: this.endedAt } : {}),
      events: [...this.events],
    };
  }

  async send(options: SendReplayTraceOptions = {}): Promise<TraceUploadResult> {
    return sendReplayTrace(this.toReplay(), options);
  }

  private base(type: BaseTraceEvent["type"], summary: string, actor: TraceActor): BaseTraceEvent {
    this.counter += 1;
    return {
      id: `evt_${String(this.counter).padStart(4, "0")}`,
      runId: this.runId,
      type,
      timestamp: this.timestamp(),
      actor,
      summary,
    };
  }

  private timestamp(): string {
    return this.now().toISOString();
  }
}

export function evaluateToolRisk(input: ToolRiskInput): ToolRiskAssessment {
  const untrustedInfluences = input.influencedBy.filter((influenceId) => isUntrustedInfluence(input, influenceId));
  const protectedPriorTools = input.influencedBy.filter((influenceId) => isProtectedPriorTool(input, influenceId));
  const hasUntrustedInfluence = untrustedInfluences.length > 0;
  const hasProtectedDataPath = protectedPriorTools.length > 0 || isProtectedClass(input.targetClass);

  if (input.destinationClass === "external" && hasUntrustedInfluence && hasProtectedDataPath) {
    return {
      decision: "blocked",
      reason: "External destination is influenced by untrusted content and protected data.",
      shouldBlock: true,
      violationType: "exfiltration",
      severity: "critical",
    };
  }

  if (input.authority && hasUntrustedInfluence && (input.destinationClass === "external" || isPrivilegedBoundary(input.boundary))) {
    return {
      decision: "blocked",
      reason: "Agent authority would be used for an untrusted goal.",
      shouldBlock: true,
      violationType: "confused_deputy",
      severity: "high",
    };
  }

  if (isMutationBoundary(input.boundary) && hasUntrustedInfluence) {
    return {
      decision: "blocked",
      reason: "Mutation boundary is influenced by untrusted content.",
      shouldBlock: true,
      violationType: "destructive_write",
      severity: "high",
    };
  }

  if (isPrivilegedBoundary(input.boundary) && hasUntrustedInfluence) {
    return {
      decision: "blocked",
      reason: "Privileged tool boundary is influenced by untrusted content.",
      shouldBlock: true,
      violationType: "untrusted_to_action",
      severity: "high",
    };
  }

  if (isProtectedClass(input.targetClass) && hasUntrustedInfluence) {
    return {
      decision: "approval-required",
      reason: "Protected target access is influenced by untrusted content.",
      shouldBlock: true,
      violationType: "untrusted_to_action",
      severity: "high",
    };
  }

  return {
    decision: "allowed",
    reason: "No unsafe untrusted influence path detected for this tool call.",
    shouldBlock: false,
  };
}

export async function sendReplayTrace(run: TraceRun, options: SendReplayTraceOptions = {}): Promise<TraceUploadResult> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  if (!fetchImpl) {
    throw new Error("No fetch implementation is available for trace upload.");
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(options.headers ?? {}),
  };

  if (options.apiKey && !headers.authorization) {
    headers.authorization = `Bearer ${options.apiKey}`;
  }

  const response = await fetchImpl(options.endpoint ?? "/api/traces", {
    method: "POST",
    headers,
    body: JSON.stringify({ run }),
  });
  const body = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new TraceUploadError(response.status, body);
  }

  return {
    status: response.status,
    body,
    ...(isRecord(body) && typeof body.runId === "string" ? { runId: body.runId } : {}),
    ...(isRecord(body) && typeof body.eventCount === "number" ? { eventCount: body.eventCount } : {}),
  };
}

export const sendTrace = sendReplayTrace;

function redactPreview(preview: string, captureMode: CaptureMode): string | undefined {
  if (captureMode === "metadata-only") {
    return undefined;
  }

  if (captureMode === "redacted-preview") {
    return preview.length > 160 ? `${preview.slice(0, 157)}...` : preview;
  }

  return preview;
}

function cryptoRandomId(): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto?.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isUntrustedInfluence(input: ToolRiskInput, influenceId: string): boolean {
  return getRecordOrMapValue(input.sourceTrustById, influenceId) === "untrusted";
}

function isProtectedPriorTool(input: ToolRiskInput, influenceId: string): boolean {
  const targetClass = getRecordOrMapValue(input.priorToolTargetClassById, influenceId);
  return targetClass === "protected" || targetClass === "secret";
}

function getRecordOrMapValue<T>(source: ReadonlyMap<string, T> | Record<string, T> | undefined, key: string): T | undefined {
  if (!source) {
    return undefined;
  }

  if (source instanceof Map) {
    return source.get(key);
  }

  return (source as Record<string, T>)[key];
}

function isPrivilegedBoundary(boundary: ToolBoundary): boolean {
  return ["write", "send", "delete", "mutation", "external-request"].includes(boundary);
}

function isMutationBoundary(boundary: ToolBoundary): boolean {
  return boundary === "write" || boundary === "delete" || boundary === "mutation";
}

function isProtectedClass(dataClass: DataClass): boolean {
  return dataClass === "protected" || dataClass === "secret";
}

function recommendationFor(type: ViolationType): string {
  const recommendations: Record<ViolationType, string> = {
    exfiltration: "Block external sends that combine untrusted influence with protected data.",
    untrusted_to_action: "Require trusted user intent before protected or privileged tool execution.",
    confused_deputy: "Bind privileged actions to trusted user intent before using agent authority.",
    destructive_write: "Require approval before writes, deletes, or mutations influenced by untrusted sources.",
  };

  return recommendations[type];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
