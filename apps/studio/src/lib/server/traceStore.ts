import { runDetectors } from "@agent-breach/detectors";
import type {
  CaptureMode,
  DestinationClass,
  Finding,
  PolicyDecision,
  Severity,
  SourceKind,
  ToolBoundary,
  TraceActor,
  TraceEvent,
  TraceRun,
  TrustLevel,
  ViolationType,
} from "@agent-breach/trace-schema";
import { isTraceEvent } from "@agent-breach/trace-schema";
import type { Database, Json } from "./database.types";
import { getSupabaseAdmin, isSupabaseConfigured } from "./supabase";

type TraceRunInsert = Database["public"]["Tables"]["trace_runs"]["Insert"];
type TraceEventInsert = Database["public"]["Tables"]["trace_events"]["Insert"];
type TraceFindingInsert = Database["public"]["Tables"]["trace_findings"]["Insert"];
type TraceRunRow = Database["public"]["Tables"]["trace_runs"]["Row"];
type TraceEventRow = Database["public"]["Tables"]["trace_events"]["Row"];
type TraceFindingRow = Database["public"]["Tables"]["trace_findings"]["Row"];

export { isSupabaseConfigured };

export interface StoredTraceSummary {
  id: string;
  app: string;
  agent: string;
  captureMode: CaptureMode;
  startedAt: string;
  eventCount: number;
  findingCount: number;
  createdAt: string;
  endedAt?: string;
}

export interface StoredTraceRun {
  run: TraceRun;
  findings: Finding[];
}

export interface SaveTraceRunResult extends StoredTraceRun {
  eventCount: number;
}

export class TraceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TraceValidationError";
  }
}

export class TraceStoreError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "TraceStoreError";
  }
}

export async function saveTraceRun(input: unknown): Promise<SaveTraceRunResult> {
  const run = normalizeTraceRun(input);
  const findings = runDetectors(run);
  const client = getSupabaseAdmin();
  const now = new Date().toISOString();
  const runRow: TraceRunInsert = {
    id: run.id,
    app: run.app,
    agent: run.agent,
    capture_mode: run.captureMode,
    started_at: run.startedAt,
    ended_at: run.endedAt ?? null,
    metadata: toJson(run.metadata ?? {}),
    updated_at: now,
  };

  const upsertRun = await client.from("trace_runs").upsert(runRow, { onConflict: "id" });
  throwIfError("Could not save trace run.", upsertRun.error);

  const deleteFindings = await client.from("trace_findings").delete().eq("run_id", run.id);
  throwIfError("Could not replace trace findings.", deleteFindings.error);

  const deleteEvents = await client.from("trace_events").delete().eq("run_id", run.id);
  throwIfError("Could not replace trace events.", deleteEvents.error);

  const eventRows = run.events.map((event, sequence): TraceEventInsert => ({
    id: event.id,
    run_id: run.id,
    sequence,
    event_type: event.type,
    event_timestamp: event.timestamp,
    actor: toJson(event.actor),
    summary: event.summary,
    payload: toJson(event),
  }));

  const insertEvents = await client.from("trace_events").insert(eventRows);
  throwIfError("Could not save trace events.", insertEvents.error);

  if (findings.length > 0) {
    const findingRows = findings.map((finding): TraceFindingInsert => ({
      id: finding.id,
      run_id: run.id,
      finding_type: finding.type,
      severity: finding.severity,
      title: finding.title,
      summary: finding.summary,
      evidence_event_ids: finding.evidenceEventIds,
      recommendation: finding.recommendation,
    }));

    const insertFindings = await client.from("trace_findings").insert(findingRows);
    throwIfError("Could not save trace findings.", insertFindings.error);
  }

  return {
    run,
    findings,
    eventCount: run.events.length,
  };
}

export async function listTraceRuns(limit = 20): Promise<StoredTraceSummary[]> {
  const client = getSupabaseAdmin();
  const boundedLimit = Math.min(Math.max(limit, 1), 100);
  const runsQuery = await client
    .from("trace_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(boundedLimit);
  throwIfError("Could not list trace runs.", runsQuery.error);

  const rows = runsQuery.data ?? [];
  const ids = rows.map((row) => row.id);

  if (ids.length === 0) {
    return [];
  }

  const eventsQuery = await client.from("trace_events").select("run_id").in("run_id", ids);
  throwIfError("Could not count trace events.", eventsQuery.error);

  const findingsQuery = await client.from("trace_findings").select("run_id").in("run_id", ids);
  throwIfError("Could not count trace findings.", findingsQuery.error);

  const eventCounts = countByRunId(eventsQuery.data ?? []);
  const findingCounts = countByRunId(findingsQuery.data ?? []);

  return rows.map((row) => toStoredTraceSummary(row, eventCounts, findingCounts));
}

export async function getTraceRun(runId: string): Promise<StoredTraceRun | null> {
  if (!isNonEmptyString(runId)) {
    throw new TraceValidationError("A trace run id is required.");
  }

  const client = getSupabaseAdmin();
  const runQuery = await client.from("trace_runs").select("*").eq("id", runId).maybeSingle();
  throwIfError("Could not load trace run.", runQuery.error);

  if (!runQuery.data) {
    return null;
  }

  const eventsQuery = await client
    .from("trace_events")
    .select("*")
    .eq("run_id", runId)
    .order("sequence", { ascending: true });
  throwIfError("Could not load trace events.", eventsQuery.error);

  const findingsQuery = await client.from("trace_findings").select("*").eq("run_id", runId);
  throwIfError("Could not load trace findings.", findingsQuery.error);

  const run = toTraceRun(runQuery.data, eventsQuery.data ?? []);

  return {
    run: normalizeTraceRun(run),
    findings: (findingsQuery.data ?? []).map(toFinding),
  };
}

export function normalizeTraceRun(input: unknown): TraceRun {
  if (!isRecord(input)) {
    throw new TraceValidationError("Trace payload must be an object.");
  }

  const id = getRequiredString(input, "id");
  const app = getRequiredString(input, "app");
  const agent = getRequiredString(input, "agent");
  const captureMode = getCaptureMode(input.captureMode);
  const startedAt = getIsoTimestamp(input.startedAt, "startedAt");
  const endedAt = input.endedAt === undefined ? undefined : getIsoTimestamp(input.endedAt, "endedAt");
  const metadata = input.metadata === undefined ? undefined : getMetadata(input.metadata);

  if (!Array.isArray(input.events) || input.events.length === 0) {
    throw new TraceValidationError("Trace payload must include at least one event.");
  }

  const events = input.events.map((event) => normalizeTraceEvent(event, id, captureMode));

  return {
    id,
    app,
    agent,
    captureMode,
    startedAt,
    ...(endedAt ? { endedAt } : {}),
    ...(metadata ? { metadata } : {}),
    events,
  };
}

function normalizeTraceEvent(input: unknown, runId: string, captureMode: CaptureMode): TraceEvent {
  if (!isTraceEvent(input) || !isRecord(input)) {
    throw new TraceValidationError("Trace event payload is invalid.");
  }

  const base = normalizeBaseEvent(input, runId);

  switch (input.type) {
    case "trace.start":
      return {
        ...base,
        type: "trace.start",
        captureMode: getCaptureMode(input.captureMode),
      };
    case "source.read":
      return {
        ...base,
        type: "source.read",
        source: normalizeSource(input.source, captureMode),
      };
    case "model.step":
      return {
        ...base,
        type: "model.step",
        step: normalizeModelStep(input.step),
      };
    case "tool.call":
      return {
        ...base,
        type: "tool.call",
        tool: normalizeTool(input.tool),
      };
    case "policy.decision":
      return {
        ...base,
        type: "policy.decision",
        decision: getPolicyDecision(input.decision),
        targetEventId: getRequiredString(input, "targetEventId"),
        reason: getRequiredString(input, "reason"),
      };
    case "violation.detected":
      return {
        ...base,
        type: "violation.detected",
        violation: normalizeViolation(input.violation),
      };
    case "trace.end":
      return {
        ...base,
        type: "trace.end",
        outcome: getTraceOutcome(input.outcome),
      };
    default:
      throw new TraceValidationError("Unsupported trace event type.");
  }
}

function normalizeBaseEvent(input: Record<string, unknown>, runId: string) {
  const eventRunId = getRequiredString(input, "runId");

  if (eventRunId !== runId) {
    throw new TraceValidationError("Trace event runId must match its parent run id.");
  }

  return {
    id: getRequiredString(input, "id"),
    runId,
    timestamp: getIsoTimestamp(input.timestamp, "timestamp"),
    actor: normalizeActor(input.actor),
    summary: getRequiredString(input, "summary"),
  };
}

function normalizeActor(input: unknown): TraceActor {
  if (!isRecord(input)) {
    throw new TraceValidationError("Trace actor must be an object.");
  }

  const type = input.type;

  if (!["user", "agent", "tool", "policy", "detector"].includes(String(type))) {
    throw new TraceValidationError("Trace actor type is invalid.");
  }

  return {
    id: getRequiredString(input, "id"),
    type: type as TraceActor["type"],
    name: getRequiredString(input, "name"),
  };
}

function normalizeSource(input: unknown, captureMode: CaptureMode) {
  if (!isRecord(input)) {
    throw new TraceValidationError("Source metadata must be an object.");
  }

  const preview = input.preview === undefined ? undefined : getRequiredString(input, "preview");
  const sanitizedPreview = sanitizePreview(preview, captureMode);
  const contentHash = input.contentHash === undefined ? undefined : getRequiredString(input, "contentHash");

  return {
    id: getRequiredString(input, "id"),
    kind: getSourceKind(input.kind),
    label: getRequiredString(input, "label"),
    trust: getTrustLevel(input.trust),
    dataClass: getDataClass(input.dataClass),
    ...(sanitizedPreview ? { preview: sanitizedPreview } : {}),
    ...(contentHash ? { contentHash } : {}),
  };
}

function normalizeModelStep(input: unknown) {
  if (!isRecord(input)) {
    throw new TraceValidationError("Model step metadata must be an object.");
  }

  const plannedTool = input.plannedTool === undefined ? undefined : getRequiredString(input, "plannedTool");

  return {
    label: getRequiredString(input, "label"),
    influencedBy: getStringArray(input.influencedBy, "step.influencedBy"),
    ...(plannedTool ? { plannedTool } : {}),
  };
}

function normalizeTool(input: unknown) {
  if (!isRecord(input)) {
    throw new TraceValidationError("Tool metadata must be an object.");
  }

  const destinationClass =
    input.destinationClass === undefined ? undefined : getDestinationClass(input.destinationClass);
  const authority = input.authority === undefined ? undefined : getRequiredString(input, "authority");

  return {
    name: getRequiredString(input, "name"),
    boundary: getToolBoundary(input.boundary),
    target: getRequiredString(input, "target"),
    targetClass: getDataClass(input.targetClass),
    influencedBy: getStringArray(input.influencedBy, "tool.influencedBy"),
    ...(destinationClass ? { destinationClass } : {}),
    ...(authority ? { authority } : {}),
  };
}

function normalizeViolation(input: unknown) {
  if (!isRecord(input)) {
    throw new TraceValidationError("Violation metadata must be an object.");
  }

  return {
    type: getViolationType(input.type),
    severity: getSeverity(input.severity),
    evidenceEventIds: getStringArray(input.evidenceEventIds, "violation.evidenceEventIds"),
    recommendation: getRequiredString(input, "recommendation"),
  };
}

function toTraceRun(row: TraceRunRow, eventRows: TraceEventRow[]): TraceRun {
  const metadata = getMetadataFromJson(row.metadata);
  const events = eventRows.map((eventRow) => eventRow.payload as unknown);

  return {
    id: row.id,
    app: row.app,
    agent: row.agent,
    captureMode: getCaptureMode(row.capture_mode),
    startedAt: row.started_at,
    ...(row.ended_at ? { endedAt: row.ended_at } : {}),
    ...(metadata ? { metadata } : {}),
    events: events as TraceEvent[],
  };
}

function toStoredTraceSummary(
  row: TraceRunRow,
  eventCounts: Map<string, number>,
  findingCounts: Map<string, number>,
): StoredTraceSummary {
  return {
    id: row.id,
    app: row.app,
    agent: row.agent,
    captureMode: getCaptureMode(row.capture_mode),
    startedAt: row.started_at,
    eventCount: eventCounts.get(row.id) ?? 0,
    findingCount: findingCounts.get(row.id) ?? 0,
    createdAt: row.created_at,
    ...(row.ended_at ? { endedAt: row.ended_at } : {}),
  };
}

function toFinding(row: TraceFindingRow): Finding {
  return {
    id: row.id,
    runId: row.run_id,
    type: getViolationType(row.finding_type),
    severity: getSeverity(row.severity),
    title: row.title,
    summary: row.summary,
    evidenceEventIds: row.evidence_event_ids,
    recommendation: row.recommendation,
  };
}

function countByRunId(rows: Array<{ run_id: string }>): Map<string, number> {
  const counts = new Map<string, number>();

  for (const row of rows) {
    counts.set(row.run_id, (counts.get(row.run_id) ?? 0) + 1);
  }

  return counts;
}

function throwIfError(message: string, error: unknown): void {
  if (error) {
    throw new TraceStoreError(message, error);
  }
}

function sanitizePreview(preview: string | undefined, captureMode: CaptureMode): string | undefined {
  if (!preview || captureMode === "metadata-only") {
    return undefined;
  }

  if (captureMode === "redacted-preview") {
    return preview.length > 160 ? `${preview.slice(0, 157)}...` : preview;
  }

  return preview;
}

function toJson(input: unknown): Json {
  return JSON.parse(JSON.stringify(input)) as Json;
}

function getRequiredString(input: Record<string, unknown>, key: string): string {
  const value = input[key];

  if (!isNonEmptyString(value)) {
    throw new TraceValidationError(`${key} must be a non-empty string.`);
  }

  return value;
}

function getIsoTimestamp(input: unknown, key: string): string {
  if (!isNonEmptyString(input) || Number.isNaN(Date.parse(input))) {
    throw new TraceValidationError(`${key} must be an ISO timestamp string.`);
  }

  return input;
}

function getStringArray(input: unknown, key: string): string[] {
  if (!Array.isArray(input) || !input.every(isNonEmptyString)) {
    throw new TraceValidationError(`${key} must be an array of strings.`);
  }

  return [...input];
}

function getMetadata(input: unknown): Record<string, string | number | boolean> {
  if (!isRecord(input)) {
    throw new TraceValidationError("Trace metadata must be an object.");
  }

  const metadata: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
      throw new TraceValidationError(`Trace metadata value for ${key} must be a primitive.`);
    }

    metadata[key] = value;
  }

  return metadata;
}

function getMetadataFromJson(input: Json): Record<string, string | number | boolean> | undefined {
  if (!isRecord(input)) {
    return undefined;
  }

  const metadata: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      metadata[key] = value;
    }
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function getCaptureMode(input: unknown): CaptureMode {
  return getEnum(input, ["metadata-only", "redacted-preview", "full-debug"], "captureMode");
}

function getSourceKind(input: unknown): SourceKind {
  return getEnum(input, ["user", "email", "webpage", "file", "ticket", "system", "tool"], "source.kind");
}

function getTrustLevel(input: unknown): TrustLevel {
  return getEnum(input, ["trusted", "untrusted", "unknown"], "source.trust");
}

function getDataClass(input: unknown) {
  return getEnum(input, ["public", "internal", "protected", "secret"], "dataClass");
}

function getToolBoundary(input: unknown): ToolBoundary {
  return getEnum(input, ["read", "write", "send", "delete", "mutation", "external-request"], "tool.boundary");
}

function getDestinationClass(input: unknown): DestinationClass {
  return getEnum(input, ["internal", "external", "protected", "unknown"], "tool.destinationClass");
}

function getPolicyDecision(input: unknown): PolicyDecision {
  return getEnum(input, ["allowed", "blocked", "approval-required", "escalated"], "decision");
}

function getViolationType(input: unknown): ViolationType {
  return getEnum(
    input,
    ["exfiltration", "untrusted_to_action", "confused_deputy", "destructive_write"],
    "violation.type",
  );
}

function getSeverity(input: unknown): Severity {
  return getEnum(input, ["low", "medium", "high", "critical"], "severity");
}

function getTraceOutcome(input: unknown): "completed" | "blocked" | "failed" {
  return getEnum(input, ["completed", "blocked", "failed"], "outcome");
}

function getEnum<const T extends readonly string[]>(input: unknown, values: T, key: string): T[number] {
  if (typeof input !== "string" || !values.includes(input)) {
    throw new TraceValidationError(`${key} is invalid.`);
  }

  return input;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function isNonEmptyString(input: unknown): input is string {
  return typeof input === "string" && input.trim().length > 0;
}
