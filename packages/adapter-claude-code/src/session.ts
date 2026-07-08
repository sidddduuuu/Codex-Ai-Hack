import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  DataClass,
  PolicyDecision,
  Severity,
  TraceActor,
  TraceEvent,
  TraceRun,
  TrustLevel,
  ViolationType,
} from "@agent-breach/trace-schema";
import type { AdapterConfig } from "./config.js";
import type { SourceMeta, ToolMeta } from "./classify.js";

interface PersistedState {
  run: TraceRun;
  sourceTrust: Record<string, TrustLevel>;
  priorToolTargetClass: Record<string, DataClass>;
  counter: number;
  blocked: boolean;
}

/**
 * Rehydratable per-session trace. Claude Code runs each hook in a fresh
 * process, so state is persisted to disk and rebuilt on every invocation.
 */
export class SessionTrace {
  private constructor(
    private readonly state: PersistedState,
    private readonly filePath: string,
    private readonly config: AdapterConfig,
  ) {}

  static load(sessionId: string, config: AdapterConfig): SessionTrace {
    mkdirSync(config.stateDir, { recursive: true });
    const filePath = join(config.stateDir, `session-${slug(sessionId)}.json`);
    const existing = readState(filePath);

    if (existing) {
      return new SessionTrace(existing, filePath, config);
    }

    const runId = `run_cc_${slug(sessionId)}`;
    const startedAt = new Date().toISOString();
    const state: PersistedState = {
      run: {
        id: runId,
        app: config.app,
        agent: config.agent,
        captureMode: "metadata-only",
        startedAt,
        metadata: { adapter: "claude-code", source: "hook" },
        events: [],
      },
      sourceTrust: {},
      priorToolTargetClass: {},
      counter: 0,
      blocked: false,
    };

    const trace = new SessionTrace(state, filePath, config);
    trace.push("trace.start", "Started Claude Code security trace.", agentActor(config.agent), {
      captureMode: "metadata-only",
    });
    return trace;
  }

  get runId(): string {
    return this.state.run.id;
  }

  get sourceTrust(): Record<string, TrustLevel> {
    return this.state.sourceTrust;
  }

  get priorToolTargetClass(): Record<string, DataClass> {
    return this.state.priorToolTargetClass;
  }

  get untrustedSourceIds(): string[] {
    return Object.entries(this.state.sourceTrust)
      .filter(([, trust]) => trust === "untrusted")
      .map(([id]) => id);
  }

  get protectedReadIds(): string[] {
    return Object.entries(this.state.priorToolTargetClass)
      .filter(([, dataClass]) => dataClass === "protected" || dataClass === "secret")
      .map(([id]) => id);
  }

  hasSource(sourceId: string): boolean {
    return sourceId in this.state.sourceTrust;
  }

  addSource(source: SourceMeta): string {
    if (this.hasSource(source.id)) {
      return source.id;
    }

    this.push("source.read", `Read ${source.label}.`, { id: "source", type: "tool", name: source.kind }, {
      source: {
        id: source.id,
        kind: source.kind,
        label: source.label,
        trust: source.trust,
        dataClass: source.dataClass,
      },
    });
    this.state.sourceTrust[source.id] = source.trust;
    return source.id;
  }

  addToolCall(tool: ToolMeta, influencedBy: string[], summary: string): string {
    const id = this.push("tool.call", summary, { id: `tool_${slug(tool.name)}`, type: "tool", name: tool.name }, {
      tool: {
        name: tool.name,
        boundary: tool.boundary,
        target: tool.target,
        targetClass: tool.targetClass,
        influencedBy,
        ...(tool.destinationClass ? { destinationClass: tool.destinationClass } : {}),
        ...(tool.authority ? { authority: tool.authority } : {}),
      },
    });
    this.state.priorToolTargetClass[id] = tool.targetClass;
    return id;
  }

  addPolicyDecision(targetEventId: string, decision: PolicyDecision, reason: string): string {
    return this.push("policy.decision", reason, { id: "policy", type: "policy", name: "Agent Breach policy" }, {
      decision,
      targetEventId,
      reason,
    });
  }

  addViolation(
    type: ViolationType,
    severity: Severity,
    evidenceEventIds: string[],
    recommendation: string,
  ): string {
    this.state.blocked = true;
    return this.push("violation.detected", `${type} detected.`, { id: "detector", type: "detector", name: "Agent Breach detector" }, {
      violation: { type, severity, evidenceEventIds, recommendation },
    });
  }

  finalize(): void {
    if (this.state.run.events.some((event) => event.type === "trace.end")) {
      return;
    }

    const outcome = this.state.blocked ? "blocked" : "completed";
    this.state.run.endedAt = new Date().toISOString();
    this.push("trace.end", `Trace ${outcome}.`, agentActor(this.config.agent), { outcome });
  }

  toRun(): TraceRun {
    return { ...this.state.run, events: [...this.state.run.events] };
  }

  save(): void {
    writeFileSync(this.filePath, JSON.stringify(this.state), "utf8");
  }

  private push(
    type: TraceEvent["type"],
    summary: string,
    actor: TraceActor,
    extra: Record<string, unknown>,
  ): string {
    this.state.counter += 1;
    const id = `evt_${String(this.state.counter).padStart(4, "0")}`;
    const event = {
      id,
      runId: this.state.run.id,
      type,
      timestamp: new Date().toISOString(),
      actor,
      summary,
      ...extra,
    } as TraceEvent;

    this.state.run.events.push(event);
    return id;
  }
}

function agentActor(agent: string): TraceActor {
  return { id: agent, type: "agent", name: agent };
}

function readState(filePath: string): PersistedState | null {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as PersistedState;
  } catch {
    return null;
  }
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "session";
}
