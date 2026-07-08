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
}

export function createSecurityTrace(options: CreateSecurityTraceOptions): SecurityTrace {
  return new SecurityTrace(options);
}

export class SecurityTrace {
  private readonly now: () => Date;
  private readonly runId: string;
  private readonly app: string;
  private readonly agent: string;
  private readonly captureMode: CaptureMode;
  private readonly events: TraceEvent[] = [];
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
      this.tool({
        name,
        boundary: options.boundary,
        target,
        targetClass: options.targetClass,
        influencedBy: options.influencedBy ?? [],
        ...(options.destinationClass ? { destinationClass: options.destinationClass } : {}),
        ...(options.authority ? { authority: options.authority } : {}),
      });

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
