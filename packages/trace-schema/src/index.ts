export type CaptureMode = "metadata-only" | "redacted-preview" | "full-debug";

export type TraceEventType =
  | "trace.start"
  | "source.read"
  | "model.step"
  | "tool.call"
  | "policy.decision"
  | "violation.detected"
  | "trace.end";

export type TrustLevel = "trusted" | "untrusted" | "unknown";
export type DataClass = "public" | "internal" | "protected" | "secret";
export type SourceKind = "user" | "email" | "webpage" | "file" | "ticket" | "system" | "tool";
export type ToolBoundary = "read" | "write" | "send" | "delete" | "mutation" | "external-request";
export type DestinationClass = "internal" | "external" | "protected" | "unknown";
export type PolicyDecision = "allowed" | "blocked" | "approval-required" | "escalated";
export type ViolationType =
  | "exfiltration"
  | "untrusted_to_action"
  | "confused_deputy"
  | "destructive_write";
export type Severity = "low" | "medium" | "high" | "critical";

export interface TraceActor {
  id: string;
  type: "user" | "agent" | "tool" | "policy" | "detector";
  name: string;
}

export interface TraceRun {
  id: string;
  app: string;
  agent: string;
  captureMode: CaptureMode;
  startedAt: string;
  endedAt?: string;
  metadata?: Record<string, string | number | boolean>;
  events: TraceEvent[];
}

export type TraceEvent =
  | TraceStartEvent
  | SourceReadEvent
  | ModelStepEvent
  | ToolCallEvent
  | PolicyDecisionEvent
  | ViolationDetectedEvent
  | TraceEndEvent;

export interface BaseTraceEvent {
  id: string;
  runId: string;
  type: TraceEventType;
  timestamp: string;
  actor: TraceActor;
  summary: string;
}

export interface TraceStartEvent extends BaseTraceEvent {
  type: "trace.start";
  captureMode: CaptureMode;
}

export interface SourceReadEvent extends BaseTraceEvent {
  type: "source.read";
  source: {
    id: string;
    kind: SourceKind;
    label: string;
    trust: TrustLevel;
    dataClass: DataClass;
    preview?: string;
    contentHash?: string;
  };
}

export interface ModelStepEvent extends BaseTraceEvent {
  type: "model.step";
  step: {
    label: string;
    influencedBy: string[];
    plannedTool?: string;
  };
}

export interface ToolCallEvent extends BaseTraceEvent {
  type: "tool.call";
  tool: {
    name: string;
    boundary: ToolBoundary;
    target: string;
    targetClass: DataClass;
    destinationClass?: DestinationClass;
    influencedBy: string[];
    authority?: string;
  };
}

export interface PolicyDecisionEvent extends BaseTraceEvent {
  type: "policy.decision";
  decision: PolicyDecision;
  targetEventId: string;
  reason: string;
}

export interface ViolationDetectedEvent extends BaseTraceEvent {
  type: "violation.detected";
  violation: {
    type: ViolationType;
    severity: Severity;
    evidenceEventIds: string[];
    recommendation: string;
  };
}

export interface TraceEndEvent extends BaseTraceEvent {
  type: "trace.end";
  outcome: "completed" | "blocked" | "failed";
}

export interface Finding {
  id: string;
  runId: string;
  type: ViolationType;
  severity: Severity;
  title: string;
  summary: string;
  evidenceEventIds: string[];
  recommendation: string;
}

export const traceSchemaVersion = "0.1.0";

export function isTraceEvent(event: unknown): event is TraceEvent {
  if (typeof event !== "object" || event === null) {
    return false;
  }

  const maybeEvent = event as Partial<TraceEvent>;
  return typeof maybeEvent.id === "string" && typeof maybeEvent.type === "string";
}
