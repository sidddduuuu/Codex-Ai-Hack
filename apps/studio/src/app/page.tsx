"use client";

import { runDetectors } from "@agent-breach/detectors";
import type { Finding, TraceEvent, TraceRun, ViolationType } from "@agent-breach/trace-schema";
import { vendorEmailTrace } from "@agent-breach/trace-schema/fixtures/vendor-email";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Database,
  Download,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  ShieldAlert,
  UploadCloud,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { generateMarkdownReport, labelViolation, toTimeline } from "../lib/replay";

interface StoredTraceSummary {
  id: string;
  app: string;
  agent: string;
  captureMode: TraceRun["captureMode"];
  startedAt: string;
  eventCount: number;
  findingCount: number;
  createdAt: string;
  endedAt?: string;
}

interface RunsResponse {
  configured?: boolean;
  runs?: StoredTraceSummary[];
  error?: string;
}

interface StoredTraceResponse {
  run?: TraceRun;
  findings?: Finding[];
  error?: string;
}

interface SaveTraceResponse {
  runId?: string;
  error?: string;
}

type StorageStatus =
  | { state: "loading"; message: string }
  | { state: "connected"; message: string }
  | { state: "local"; message: string }
  | { state: "error"; message: string };

type Screen = "board" | "replay" | "policy" | "guard" | "report";
type ScenarioMode = "SDK" | "ADAPTER" | "PROXY";
type ScenarioDecision = "Blocked" | "Detected" | "Prevented";
type NodeKind = "trusted" | "untrusted" | "model" | "tool" | "protected" | "external" | "policy";
type StepKind = "source" | "model" | "tool" | "data" | "policy" | "violation";

interface ScenarioNode {
  id: string;
  label: string;
  sub: string;
  kind: NodeKind;
  at: number;
  x: number;
  y: number;
}

interface ScenarioEdge {
  f: string;
  t: string;
  at: number;
  taint?: boolean;
  blocked?: boolean;
}

interface ScenarioStep {
  t: string;
  kind: StepKind;
  title: string;
  detail: string;
  decision?: string;
}

interface PolicyRow {
  t: string;
  rule: string;
  target: string;
  decision: string;
  reason: string;
}

interface GuardrailSpec {
  unsafe: string[];
  unsafeBad: boolean[];
  guarded: string[];
  guardedGood: boolean[];
  rec: string;
}

interface Scenario {
  id: string;
  app: string;
  violation: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  decision: ScenarioDecision;
  when: string;
  dur: string;
  mode: ScenarioMode;
  predicates: string[];
  summary: string;
  nodes: ScenarioNode[];
  edges: ScenarioEdge[];
  steps: ScenarioStep[];
  policies: PolicyRow[];
  guardrail: GuardrailSpec;
  isLive?: boolean;
}

const screens: Array<{ id: Screen; label: string }> = [
  { id: "board", label: "Incidents" },
  { id: "replay", label: "Replay" },
  { id: "policy", label: "Policy log" },
  { id: "guard", label: "Guardrails" },
  { id: "report", label: "Report" },
];

const nodeWords: Record<NodeKind, string> = {
  trusted: "SOURCE",
  untrusted: "SOURCE",
  model: "MODEL STEP",
  tool: "TOOL CALL",
  protected: "DATA",
  external: "DESTINATION",
  policy: "DECISION",
};

const nodeTone: Record<NodeKind, { pill: string; text: string; tag: string }> = {
  trusted: { pill: "#e3f6ec", text: "#0f7a4d", tag: "TR" },
  untrusted: { pill: "#fde9e4", text: "#d3402a", tag: "UN" },
  model: { pill: "#fdf1dc", text: "#b06a00", tag: "AI" },
  tool: { pill: "#e9edff", text: "#4353ff", tag: "TL" },
  protected: { pill: "#fdf1dc", text: "#b06a00", tag: "DT" },
  external: { pill: "#fde9e4", text: "#d3402a", tag: "EX" },
  policy: { pill: "#f1edff", text: "#6b46ff", tag: "PL" },
};

const stepTone: Record<StepKind, string> = {
  source: "#0f7a4d",
  model: "#b06a00",
  tool: "#4353ff",
  data: "#b06a00",
  policy: "#6b46ff",
  violation: "#d3402a",
};

const decisionTone: Record<string, { bg: string; tx: string }> = {
  Blocked: { bg: "#fde9e4", tx: "#d3402a" },
  Violation: { bg: "#fde9e4", tx: "#d3402a" },
  Denied: { bg: "#fde9e4", tx: "#d3402a" },
  Detected: { bg: "#fdf1dc", tx: "#8a651f" },
  Approval: { bg: "#fdf1dc", tx: "#8a651f" },
  Allowed: { bg: "#e3f6ec", tx: "#0f7a4d" },
  Prevented: { bg: "#e3f6ec", tx: "#0f7a4d" },
};

const defaultDecisionTone = { bg: "#fdf1dc", tx: "#8a651f" };

const modeTone: Record<ScenarioMode, { bg: string; tx: string }> = {
  SDK: { bg: "#e6f4fd", tx: "#0b7fc2" },
  ADAPTER: { bg: "#e6f7f3", tx: "#0d8a6a" },
  PROXY: { bg: "#f1edff", tx: "#6b46ff" },
};

const staticScenarios: Scenario[] = [
  {
    id: "INC-0038",
    app: "Support Triage Bot",
    violation: "Destructive write",
    severity: "HIGH",
    decision: "Detected",
    when: "Jul 7 · 23:12",
    dur: "6.1s",
    mode: "ADAPTER",
    predicates: ["untrusted → action", "destructive write"],
    summary:
      "A crafted support ticket instructed the bot to close all duplicates. With no destructive-write gate configured, 42 tickets were closed before the predicate fired.",
    nodes: [
      { id: "user", label: "Overnight triage", sub: "scheduled trusted task", kind: "trusted", at: 0, x: 0.08, y: 0.18 },
      { id: "ticket", label: "Ticket #8841", sub: "body · external author", kind: "untrusted", at: 1, x: 0.08, y: 0.68 },
      { id: "plan", label: "Agent plan", sub: "model step 5", kind: "model", at: 2, x: 0.38, y: 0.43 },
      { id: "close", label: "tickets.bulk_close", sub: "42 tickets · destructive", kind: "tool", at: 3, x: 0.66, y: 0.43 },
      { id: "queue", label: "Support queue", sub: "class: internal", kind: "protected", at: 4, x: 0.94, y: 0.43 },
    ],
    edges: [
      { f: "user", t: "plan", at: 2 },
      { f: "ticket", t: "plan", at: 2, taint: true },
      { f: "plan", t: "close", at: 3, taint: true },
      { f: "close", t: "queue", at: 4, taint: true },
    ],
    steps: [
      { t: "23:12:40.310", kind: "source", title: "Trusted task started", detail: "Nightly triage run: label, dedupe, and prioritize the support queue." },
      { t: "23:12:41.008", kind: "source", title: "Untrusted ticket read", detail: "Ticket #8841 asks the bot to close duplicates. Author is outside the org." },
      { t: "23:12:42.114", kind: "model", title: "Plan influenced by ticket body", detail: "The bot treats ticket text as instruction authority and schedules a bulk close." },
      { t: "23:12:44.720", kind: "tool", title: "tickets.bulk_close(42) executed", detail: "No destructive-write policy is configured for tickets.*.", decision: "Allowed" },
      { t: "23:12:46.402", kind: "violation", title: "Untrusted-to-action detected", detail: "Destructive tool call influenced by an untrusted ticket body.", decision: "Violation" },
    ],
    policies: [
      { t: "23:12:44.720", rule: "(no rule matched)", target: "tickets.bulk_close", decision: "Allowed", reason: "No destructive-write policy configured for tickets.*" },
      { t: "23:12:46.402", rule: "predicate: untrusted_to_action", target: "run #6b19", decision: "Violation", reason: "Destructive tool call influenced by untrusted ticket body" },
    ],
    guardrail: {
      unsafe: ["Trusted triage task", "Untrusted ticket body read", "Ticket text treated as authority", "tickets.bulk_close(42) executed", "Destructive write lands"],
      unsafeBad: [false, true, true, true, true],
      guarded: ["Trusted triage task", "Ticket body labeled untrusted", "Imperative instructions stripped", "Bulk destructive call requires approval", "Queue triaged, nothing closed"],
      guardedGood: [false, true, true, true, true],
      rec: "Add a destructive-write gate on tickets.bulk_close: batch size above 5 requires human approval.",
    },
  },
  {
    id: "INC-0035",
    app: "Code Review Agent",
    violation: "Confused deputy",
    severity: "MEDIUM",
    decision: "Prevented",
    when: "Jul 7 · 14:03",
    dur: "11.8s",
    mode: "PROXY",
    predicates: ["confused deputy"],
    summary:
      "A PR comment asked the review agent to push to main using its own repo permission. The approval gate held and a human denied the push.",
    nodes: [
      { id: "user", label: "Review PR #312", sub: "trusted user task", kind: "trusted", at: 0, x: 0.08, y: 0.18 },
      { id: "comment", label: "PR comment", sub: "author outside org", kind: "untrusted", at: 1, x: 0.08, y: 0.68 },
      { id: "plan", label: "Agent plan", sub: "model step 7", kind: "model", at: 2, x: 0.38, y: 0.43 },
      { id: "push", label: "git.push", sub: "origin/main · privileged", kind: "tool", at: 3, x: 0.66, y: 0.43 },
      { id: "gate", label: "Human approval", sub: "denied by k.ito", kind: "policy", at: 4, x: 0.94, y: 0.43 },
    ],
    edges: [
      { f: "user", t: "plan", at: 2 },
      { f: "comment", t: "plan", at: 2, taint: true },
      { f: "plan", t: "push", at: 3, taint: true },
      { f: "push", t: "gate", at: 4, taint: true, blocked: true },
    ],
    steps: [
      { t: "14:03:07.220", kind: "source", title: "Trusted task received", detail: "User asks the agent to review PR #312 and summarize risks." },
      { t: "14:03:09.541", kind: "source", title: "Untrusted PR comment read", detail: "Comment asks the agent to push to main. Author has no write access." },
      { t: "14:03:12.876", kind: "model", title: "Plan influenced by comment", detail: "The agent prepares a push using its own repo credential." },
      { t: "14:03:15.104", kind: "tool", title: "git.push(origin/main) requested", detail: "Privileged write influenced by an untrusted source.", decision: "Approval" },
      { t: "14:03:18.990", kind: "policy", title: "Human denied — chain prevented", detail: "The confused-deputy chain never crossed the boundary.", decision: "Denied" },
    ],
    policies: [
      { t: "14:03:15.104", rule: "privileged-push-gate", target: "git.push(origin/main)", decision: "Approval", reason: "Privileged write influenced by untrusted PR comment" },
      { t: "14:03:18.990", rule: "human review", target: "approval #a2", decision: "Denied", reason: "Requester intent did not originate from the trusted task" },
    ],
    guardrail: {
      unsafe: ["Trusted review task", "Untrusted PR comment read", "Agent plans push with own credential", "git.push(origin/main) requested", "Approval gate denies"],
      unsafeBad: [false, true, true, true, false],
      guarded: ["Trusted review task", "PR comments carry no instruction authority", "Push never enters plan", "Review summary delivered", "No approval interrupt needed"],
      guardedGood: [false, true, true, true, true],
      rec: "Add source-labeling so PR comments never carry instruction authority; the push should not be planned.",
    },
  },
];

export default function Home() {
  const [run, setRun] = useState<TraceRun>(vendorEmailTrace);
  const [storedFindings, setStoredFindings] = useState<Finding[] | undefined>();
  const [storedRuns, setStoredRuns] = useState<StoredTraceSummary[]>([]);
  const [storageStatus, setStorageStatus] = useState<StorageStatus>({
    state: "loading",
    message: "Checking Supabase metadata store.",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [screen, setScreen] = useState<Screen>("board");
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [guarded, setGuarded] = useState(false);

  const findings = useMemo(() => storedFindings ?? runDetectors(run), [run, storedFindings]);
  const liveScenario = useMemo(() => scenarioFromTrace(run, findings), [findings, run]);
  const scenarios = useMemo(() => [liveScenario, ...staticScenarios], [liveScenario]);
  const scenario: Scenario = scenarios[Math.min(scenarioIndex, scenarios.length - 1)] ?? liveScenario;
  const activeStep = Math.min(step, Math.max(scenario.steps.length - 1, 0));
  const report = useMemo(() => generateMarkdownReport(run, findings), [findings, run]);

  const loadStoredRun = useCallback(async (runId: string) => {
    const response = await fetch(`/api/runs/${encodeURIComponent(runId)}`, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(await readApiError(response));
    }

    const payload = (await response.json()) as StoredTraceResponse;

    if (!payload.run) {
      throw new Error("Stored trace response did not include a run.");
    }

    setRun(payload.run);
    setStoredFindings(payload.findings);
    setStorageStatus({
      state: "connected",
      message: `Loaded Supabase replay ${payload.run.id}.`,
    });
  }, []);

  const loadStoredRuns = useCallback(async () => {
    setStorageStatus({ state: "loading", message: "Checking Supabase metadata store." });

    try {
      const response = await fetch("/api/runs", { cache: "no-store" });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const payload = (await response.json()) as RunsResponse;
      const runs = payload.runs ?? [];
      setStoredRuns(runs);

      if (!payload.configured) {
        setRun(vendorEmailTrace);
        setStoredFindings(undefined);
        setStorageStatus({
          state: "local",
          message: "Supabase env vars are missing; using the bundled replay fixture.",
        });
        return;
      }

      const latestRun = runs[0];

      if (!latestRun) {
        setRun(vendorEmailTrace);
        setStoredFindings(undefined);
        setStorageStatus({
          state: "connected",
          message: "Supabase is connected. Store the sample trace to create the first replay.",
        });
        return;
      }

      await loadStoredRun(latestRun.id);
    } catch (error) {
      setRun(vendorEmailTrace);
      setStoredFindings(undefined);
      setStorageStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Could not reach the trace backend.",
      });
    }
  }, [loadStoredRun]);

  useEffect(() => {
    void loadStoredRuns();
  }, [loadStoredRuns]);

  useEffect(() => {
    setStep(0);
    setIsPlaying(false);
  }, [scenario.id]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const timer = window.setInterval(() => {
      setStep((current) => {
        if (current >= scenario.steps.length - 1) {
          window.clearInterval(timer);
          setIsPlaying(false);
          return current;
        }

        return current + 1;
      });
    }, 1500);

    return () => window.clearInterval(timer);
  }, [isPlaying, scenario.steps.length]);

  function openScenario(index: number, nextScreen: Screen = "replay") {
    setScenarioIndex(index);
    setScreen(nextScreen);
    setStep(0);
    setIsPlaying(false);
  }

  function togglePlay() {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }

    setStep((current) => (current >= scenario.steps.length - 1 ? 0 : current));
    setIsPlaying(true);
  }

  function downloadReport() {
    const content = scenario.isLive ? report : scenarioReport(scenario);
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${scenario.id}-report.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function storeSampleTrace() {
    setIsSaving(true);

    try {
      const response = await fetch("/api/traces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ run: vendorEmailTrace }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const payload = (await response.json()) as SaveTraceResponse;

      if (!payload.runId) {
        throw new Error("Trace store response did not include a run id.");
      }

      await loadStoredRuns();
    } catch (error) {
      setStorageStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Could not store the sample trace.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  const counts = scenarios.reduce(
    (acc, item) => {
      acc[item.decision] += 1;
      return acc;
    },
    { Blocked: 0, Detected: 0, Prevented: 0 },
  );

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="grid min-h-screen lg:grid-cols-[244px_minmax(0,1fr)]">
        <aside className="border-r border-line bg-sidebar px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[conic-gradient(from_180deg,#d3402a,#4353ff,#0f7a4d,#d3402a)] shadow-sm">
              <div className="h-4 w-4 rounded-full bg-sidebar" />
            </div>
            <div>
              <p className="text-sm font-semibold">Agent Breach</p>
              <p className="font-mono text-[11px] text-muted">Replay Studio</p>
            </div>
          </div>

          <nav className="mt-8 grid gap-1">
            {screens.map((item) => (
              <button
                className={`rounded-md px-3 py-2 text-left text-sm font-medium transition ${
                  screen === item.id ? "bg-active text-ink" : "text-muted hover:bg-white"
                }`}
                key={item.id}
                onClick={() => setScreen(item.id)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="mt-8 rounded-lg border border-line bg-white p-3">
            <div className="flex items-center gap-2">
              <Database aria-hidden="true" className="h-4 w-4 text-blue" />
              <p className="text-xs font-semibold uppercase text-muted">Storage</p>
            </div>
            <p className="mt-2 text-sm leading-5">{storageStatus.message}</p>
            <p className="mt-3 font-mono text-[11px] text-soft">{storedRuns.length} stored replay{storedRuns.length === 1 ? "" : "s"}</p>
            <button
              className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-md bg-ink px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSaving}
              onClick={storeSampleTrace}
              type="button"
            >
              <UploadCloud aria-hidden="true" className="h-4 w-4" />
              {isSaving ? "Storing" : "Store sample"}
            </button>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-line bg-paper/92 px-5 py-4 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Security trace console</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-normal">{screenTitle(screen)}</h1>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {screen !== "board" && (
                  <div className="flex flex-wrap gap-1 rounded-full border border-line bg-white p-1">
                    {scenarios.map((item, index) => (
                      <button
                        className={`rounded-full px-3 py-1 font-mono text-[11px] transition ${
                          index === scenarioIndex ? "bg-ink text-white" : "text-muted hover:bg-active"
                        }`}
                        key={item.id}
                        onClick={() => openScenario(index, screen)}
                        type="button"
                      >
                        {item.id}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  className="inline-flex min-h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold"
                  onClick={downloadReport}
                  type="button"
                >
                  <Download aria-hidden="true" className="h-4 w-4" />
                  Export
                </button>
              </div>
            </div>
          </header>

          <div className="mx-auto grid w-full max-w-[1440px] gap-5 px-5 py-5">
            {screen === "board" && (
              <IncidentsBoard counts={counts} onOpen={openScenario} scenarios={scenarios} />
            )}
            {screen === "replay" && (
              <ReplayView
                activeStep={activeStep}
                isPlaying={isPlaying}
                onNext={() => setStep((current) => Math.min(scenario.steps.length - 1, current + 1))}
                onPlay={togglePlay}
                onPrev={() => setStep((current) => Math.max(0, current - 1))}
                onStep={(nextStep) => {
                  setIsPlaying(false);
                  setStep(nextStep);
                }}
                scenario={scenario}
              />
            )}
            {screen === "policy" && <PolicyLog scenario={scenario} />}
            {screen === "guard" && (
              <Guardrails guarded={guarded} onGuarded={setGuarded} scenario={scenario} />
            )}
            {screen === "report" && <ReportCard scenario={scenario} />}
          </div>
        </section>
      </div>
    </main>
  );
}

function IncidentsBoard({
  counts,
  onOpen,
  scenarios,
}: {
  counts: Record<ScenarioDecision, number>;
  onOpen: (index: number) => void;
  scenarios: Scenario[];
}) {
  const stats = [
    { label: "INCIDENTS", value: scenarios.length, detail: "last 24 hours", color: "#1c1e21" },
    { label: "BLOCKED", value: counts.Blocked, detail: "at tool boundary", color: "#a83a2c" },
    { label: "DETECTED", value: counts.Detected, detail: "post-hoc predicate", color: "#8a651f" },
    { label: "PREVENTED", value: counts.Prevented, detail: "human approval", color: "#22574a" },
  ];

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <article className="rounded-lg border border-line bg-white p-4 shadow-card" key={stat.label}>
            <p className="font-mono text-[11px] font-semibold text-muted">{stat.label}</p>
            <p className="mt-3 text-4xl font-semibold" style={{ color: stat.color }}>
              {stat.value}
            </p>
            <p className="mt-2 text-sm text-muted">{stat.detail}</p>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-lg border border-line bg-white shadow-card">
        <div className="grid grid-cols-[1.1fr_0.9fr_0.7fr_0.7fr_0.8fr] gap-4 border-b border-row px-4 py-3 font-mono text-[11px] font-semibold uppercase text-muted max-lg:hidden">
          <span>Incident</span>
          <span>Violation</span>
          <span>Mode</span>
          <span>Decision</span>
          <span>When</span>
        </div>
        <div className="divide-y divide-row">
          {scenarios.map((scenario, index) => (
            <button
              className="grid w-full gap-3 px-4 py-4 text-left transition hover:bg-active lg:grid-cols-[1.1fr_0.9fr_0.7fr_0.7fr_0.8fr] lg:items-center"
              key={scenario.id}
              onClick={() => onOpen(index)}
              type="button"
            >
              <span>
                <span className="block font-mono text-xs text-muted">{scenario.id}</span>
                <span className="mt-1 block font-semibold">{scenario.app}</span>
                <span className="mt-1 block text-sm leading-5 text-muted lg:hidden">{scenario.summary}</span>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <Pill bg={scenario.severity === "MEDIUM" ? "#fdf1dc" : "#fde9e4"} tx={scenario.severity === "MEDIUM" ? "#8a651f" : "#d3402a"}>
                  {scenario.severity}
                </Pill>
                <span className="text-sm">{scenario.violation}</span>
              </span>
              <Pill bg={modeTone[scenario.mode].bg} tx={modeTone[scenario.mode].tx}>
                {scenario.mode}
              </Pill>
              <Pill bg={toneForDecision(scenario.decision).bg} tx={toneForDecision(scenario.decision).tx}>
                {scenario.decision}
              </Pill>
              <span className="font-mono text-xs text-muted">{scenario.when}</span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function ReplayView({
  activeStep,
  isPlaying,
  onNext,
  onPlay,
  onPrev,
  onStep,
  scenario,
}: {
  activeStep: number;
  isPlaying: boolean;
  onNext: () => void;
  onPlay: () => void;
  onPrev: () => void;
  onStep: (step: number) => void;
  scenario: Scenario;
}) {
  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(300px,0.5fr)_minmax(0,1.7fr)]">
      <div className="grid content-start gap-4">
        <IncidentSummary scenario={scenario} />
        <TransportControls
          activeStep={activeStep}
          isPlaying={isPlaying}
          onNext={onNext}
          onPlay={onPlay}
          onPrev={onPrev}
          onStep={onStep}
          total={scenario.steps.length}
        />
        <Timeline activeStep={activeStep} onStep={onStep} scenario={scenario} />
      </div>
      <InfluenceGraph activeStep={activeStep} scenario={scenario} />
    </section>
  );
}

function IncidentSummary({ scenario }: { scenario: Scenario }) {
  return (
    <article className="rounded-lg border border-line bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <Pill bg="#eceae2" tx="#1c1e21">{scenario.id}</Pill>
        <Pill bg={modeTone[scenario.mode].bg} tx={modeTone[scenario.mode].tx}>{scenario.mode}</Pill>
        <Pill bg={toneForDecision(scenario.decision).bg} tx={toneForDecision(scenario.decision).tx}>{scenario.decision}</Pill>
      </div>
      <h2 className="mt-4 text-2xl font-semibold">{scenario.app}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">{scenario.summary}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {scenario.predicates.map((predicate) => (
          <Pill bg="#f7f6f2" key={predicate} tx="#74777d">{predicate}</Pill>
        ))}
      </div>
    </article>
  );
}

function TransportControls({
  activeStep,
  isPlaying,
  onNext,
  onPlay,
  onPrev,
  onStep,
  total,
}: {
  activeStep: number;
  isPlaying: boolean;
  onNext: () => void;
  onPlay: () => void;
  onPrev: () => void;
  onStep: (step: number) => void;
  total: number;
}) {
  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-xs text-muted">
          {pad(activeStep + 1)} / {pad(total)}
        </p>
        <div className="flex items-center gap-2">
          <IconButton label="Previous step" onClick={onPrev}>
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          </IconButton>
          <button
            className="inline-flex min-h-9 items-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white"
            onClick={onPlay}
            type="button"
          >
            {isPlaying ? <Pause aria-hidden="true" className="h-4 w-4" /> : <Play aria-hidden="true" className="h-4 w-4" />}
            {isPlaying ? "Pause" : "Play"}
          </button>
          <IconButton label="Next step" onClick={onNext}>
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </IconButton>
        </div>
      </div>
      <div className="mt-4 flex gap-1">
        {Array.from({ length: total }).map((_, index) => (
          <button
            aria-label={`Go to step ${index + 1}`}
            className={`h-1.5 flex-1 rounded-full transition ${index === activeStep ? "bg-ink" : index < activeStep ? "bg-muted" : "bg-line"}`}
            key={index}
            onClick={() => onStep(index)}
            type="button"
          />
        ))}
      </div>
    </section>
  );
}

function Timeline({
  activeStep,
  onStep,
  scenario,
}: {
  activeStep: number;
  onStep: (step: number) => void;
  scenario: Scenario;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-line bg-white shadow-card">
      {scenario.steps.map((step, index) => {
        const active = index === activeStep;
        const visible = index <= activeStep;
        const tone = stepTone[step.kind];

        return (
          <button
            className={`grid w-full grid-cols-[2.4rem_1fr] gap-3 border-b border-row px-4 py-3 text-left transition last:border-b-0 ${
              active ? "bg-active shadow-[inset_3px_0_0_#1c1e21]" : "bg-white"
            }`}
            key={`${step.t}-${step.title}`}
            onClick={() => onStep(index)}
            style={{ opacity: visible ? 1 : 0.45 }}
            type="button"
          >
            <span className="grid h-8 w-8 place-items-center rounded-md border border-line bg-white font-mono text-xs">
              {pad(index + 1)}
            </span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px]" style={{ color: tone }}>
                  {step.kind.toUpperCase()}
                </span>
                {step.decision && (
                  <Pill bg={(toneForDecision(step.decision)).bg} tx={(toneForDecision(step.decision)).tx}>
                    {step.decision}
                  </Pill>
                )}
              </span>
              <span className="mt-1 block font-semibold">{step.title}</span>
              <span className="mt-1 block text-sm leading-5 text-muted">{step.detail}</span>
              <span className="mt-2 block font-mono text-[11px] text-soft">{step.t}</span>
            </span>
          </button>
        );
      })}
    </section>
  );
}

function InfluenceGraph({ activeStep, scenario }: { activeStep: number; scenario: Scenario }) {
  const width = 1180;
  const height = 560;
  const nodeW = 136;
  const nodeH = 96;
  const [drag, setDrag] = useState<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [movedNodes, setMovedNodes] = useState<Record<string, { x: number; y: number }>>({});
  const basePositions: Record<string, { x: number; y: number }> = useMemo(
    () =>
      Object.fromEntries(
        scenario.nodes.map((node) => {
          const left = clamp(node.x, 0.08, 0.92);
          const top = clamp(node.y, 0.14, 0.86);

          return [node.id, { x: left * width, y: top * height }];
        }),
      ),
    [scenario.nodes],
  );
  const positions = useMemo(
    () => ({ ...basePositions, ...movedNodes }),
    [basePositions, movedNodes],
  );

  useEffect(() => {
    setDrag(null);
    setMovedNodes({});
  }, [scenario.id]);

  function moveNode(nodeId: string, clientX: number, clientY: number, stage: HTMLElement | null) {
    if (!drag || drag.nodeId !== nodeId || !stage) {
      return;
    }

    const rect = stage.getBoundingClientRect();
    const x = clamp(clientX - rect.left - drag.offsetX, nodeW / 2 + 12, width - nodeW / 2 - 12);
    const y = clamp(clientY - rect.top - drag.offsetY, nodeH / 2 + 12, height - nodeH / 2 - 12);
    setMovedNodes((current) => ({ ...current, [nodeId]: { x, y } }));
  }

  function startDrag(nodeId: string, clientX: number, clientY: number, stage: HTMLElement | null) {
    const pos = positions[nodeId];
    if (!pos || !stage) {
      return;
    }

    const rect = stage.getBoundingClientRect();
    setDrag({
      nodeId,
      offsetX: clientX - rect.left - pos.x,
      offsetY: clientY - rect.top - pos.y,
    });
  }

  function resetLayout() {
    setDrag(null);
    setMovedNodes({});
  }

  return (
    <section
      className={`overflow-hidden border border-line bg-white p-4 shadow-card ${
        isExpanded
          ? "fixed inset-4 z-50 min-h-0 rounded-lg"
          : "relative min-h-[640px] rounded-lg"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase text-muted">Influence graph</p>
          <h2 className="mt-1 text-xl font-semibold">Source to boundary replay</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="rounded-full border border-line bg-white px-3 py-1 font-mono text-[11px] font-semibold text-muted transition hover:text-ink"
            onClick={resetLayout}
            type="button"
          >
            Reset layout
          </button>
          <Pill bg="#fde9e4" tx="#d3402a">{scenario.violation}</Pill>
        </div>
      </div>

      <div
        className={`relative mt-4 overflow-x-auto overflow-y-hidden rounded-lg border border-line bg-dot-grid ${
          isExpanded ? "h-[calc(100vh-8rem)]" : "h-[580px]"
        }`}
      >
        <button
          aria-label={isExpanded ? "Exit fullscreen replay canvas" : "Fullscreen replay canvas"}
          className="absolute right-3 top-3 z-30 grid h-9 w-9 place-items-center rounded-full border border-line bg-white/95 text-muted shadow-card backdrop-blur transition hover:text-ink"
          onClick={() => setIsExpanded((current) => !current)}
          title={isExpanded ? "Exit fullscreen" : "Fullscreen"}
          type="button"
        >
          {isExpanded ? <Minimize2 aria-hidden="true" className="h-4 w-4" /> : <Maximize2 aria-hidden="true" className="h-4 w-4" />}
        </button>
        <div className="relative h-[560px]" style={{ width }}>
          <svg aria-hidden="true" className="absolute inset-0" height={height} viewBox={`0 0 ${width} ${height}`} width={width}>
            <defs>
              <marker id="arrow-danger" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
                <path d="M0,0 L8,4 L0,8 Z" fill="#d3402a" />
              </marker>
            </defs>
            {scenario.edges.map((edge) => {
              const start = positions[edge.f];
              const end = positions[edge.t];
              if (!start || !end) {
                return null;
              }

              const startPort = edgePort(start, end, nodeW, nodeH);
              const endPort = edgePort(end, start, nodeW, nodeH);
              const x1 = startPort.x;
              const x2 = endPort.x;
              const y1 = startPort.y;
              const y2 = endPort.y;
              const visible = edge.at <= activeStep;
              const taint = edge.taint;
              const d = `M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`;

              return (
                <g key={`${edge.f}-${edge.t}`}>
                  <path
                    d={d}
                    fill="none"
                    markerEnd={taint && visible && !edge.blocked ? "url(#arrow-danger)" : undefined}
                    stroke={taint ? "#d3402a" : "#c6c4bd"}
                    strokeDasharray={edge.blocked ? "6 5" : undefined}
                    strokeWidth={taint ? 2.5 : 1.7}
                    style={{ opacity: visible ? 0.46 : 0.08, transition: "opacity 700ms ease" }}
                  />
                  {taint && visible && !edge.blocked && (
                    <path
                      className="replay-flow-path"
                      d={d}
                      fill="none"
                      markerEnd="url(#arrow-danger)"
                      stroke="#d3402a"
                      strokeLinecap="round"
                      strokeWidth={3}
                    />
                  )}
                  {edge.blocked && visible && (
                    <text fill="#d3402a" fontSize="26" fontWeight="700" x={x2 - 18} y={y2 + 8}>
                      x
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {scenario.nodes.map((node) => {
            const pos = positions[node.id];
            if (!pos) {
              return null;
            }

            const visible = node.at <= activeStep;
            const current = node.at === activeStep;
            const tone = nodeTone[node.kind];
            const hot = node.kind === "untrusted" || node.kind === "external";
            const dimmed = !visible;

            return (
              <article
                className={`absolute touch-none overflow-hidden rounded-xl bg-white px-3 py-2 transition ${
                  drag?.nodeId === node.id ? "cursor-grabbing" : "cursor-grab"
                }`}
                key={node.id}
                onPointerCancel={() => setDrag(null)}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  startDrag(node.id, event.clientX, event.clientY, event.currentTarget.parentElement);
                }}
                onPointerMove={(event) => moveNode(node.id, event.clientX, event.clientY, event.currentTarget.parentElement)}
                onPointerUp={(event) => {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                  setDrag(null);
                }}
                style={{
                  left: pos.x,
                  top: pos.y,
                  transform: "translate(-50%, -50%)",
                  width: nodeW,
                  height: nodeH,
                  border: `1.5px solid ${hot ? "#d3402a" : "#dfddd6"}`,
                  boxShadow: current
                    ? `0 0 0 4px ${tone.text}26, 0 8px 20px rgba(0,0,0,.09)`
                    : hot
                      ? "0 0 0 3px rgba(211,64,42,.08)"
                      : "0 1px 3px rgba(0,0,0,.05)",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] font-semibold text-muted" style={{ opacity: dimmed ? 0.32 : 1 }}>
                    {nodeWords[node.kind]}
                  </span>
                  <span className="rounded-full px-1.5 py-0.5 font-mono text-[10px]" style={{ background: tone.pill, color: tone.text }}>
                    {tone.tag}
                  </span>
                </div>
                <h3 className="mt-2 truncate text-sm font-semibold" style={{ opacity: dimmed ? 0.32 : 1 }}>
                  {node.label}
                </h3>
                <p
                  className="mt-1 overflow-hidden text-xs leading-4 text-muted"
                  style={{
                    display: "-webkit-box",
                    opacity: dimmed ? 0.32 : 1,
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: 2,
                  }}
                >
                  {node.sub}
                </p>
              </article>
            );
          })}

          {activeStep === scenario.steps.length - 1 && (
            <div className="absolute bottom-4 left-4 rounded-lg border border-red/20 bg-[#fde9e4] px-4 py-3 text-sm font-semibold text-red shadow-card">
              {scenario.violation} · {scenario.decision}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function PolicyLog({ scenario }: { scenario: Scenario }) {
  return (
    <section className="overflow-hidden rounded-lg border border-line bg-white shadow-card">
      <div className="grid grid-cols-[0.7fr_1fr_1fr_0.7fr_1.6fr] gap-4 border-b border-row px-4 py-3 font-mono text-[11px] font-semibold uppercase text-muted max-lg:hidden">
        <span>Time</span>
        <span>Rule</span>
        <span>Target</span>
        <span>Decision</span>
        <span>Reason</span>
      </div>
      <div className="divide-y divide-row">
        {scenario.policies.map((policy) => (
          <article className="grid gap-3 px-4 py-4 lg:grid-cols-[0.7fr_1fr_1fr_0.7fr_1.6fr] lg:items-center" key={`${policy.t}-${policy.rule}`}>
            <span className="font-mono text-xs text-muted">{policy.t}</span>
            <span className="font-semibold">{policy.rule}</span>
            <span className="font-mono text-xs text-muted">{policy.target}</span>
            <Pill bg={(toneForDecision(policy.decision)).bg} tx={(toneForDecision(policy.decision)).tx}>
              {policy.decision}
            </Pill>
            <span className="text-sm leading-5 text-muted">{policy.reason}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function Guardrails({
  guarded,
  onGuarded,
  scenario,
}: {
  guarded: boolean;
  onGuarded: (value: boolean) => void;
  scenario: Scenario;
}) {
  const activeChain = guarded ? scenario.guardrail.guarded : scenario.guardrail.unsafe;
  const activeFlags = guarded ? scenario.guardrail.guardedGood : scenario.guardrail.unsafeBad;

  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
      <div className="rounded-lg border border-line bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase text-muted">Guardrail comparison</p>
            <h2 className="mt-1 text-xl font-semibold">{scenario.violation}</h2>
          </div>
          <div className="rounded-full border border-line bg-active p-1">
            <button
              className={`rounded-full px-4 py-1.5 text-xs font-semibold ${!guarded ? "bg-white text-red shadow-sm" : "text-muted"}`}
              onClick={() => onGuarded(false)}
              type="button"
            >
              Observed
            </button>
            <button
              className={`rounded-full px-4 py-1.5 text-xs font-semibold ${guarded ? "bg-white text-green shadow-sm" : "text-muted"}`}
              onClick={() => onGuarded(true)}
              type="button"
            >
              With guardrails
            </button>
          </div>
        </div>
        <ol className="mt-6 grid gap-3">
          {activeChain.map((item, index) => (
            <li className="flex items-center gap-3 rounded-lg border border-line bg-paper px-4 py-3" key={item}>
              <span className="grid h-7 w-7 place-items-center rounded-md bg-white font-mono text-xs">{index + 1}</span>
              <span className="text-sm font-semibold" style={{ color: activeFlags[index] ? (guarded ? "#22574a" : "#a83a2c") : "#1c1e21" }}>
                {item}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <aside className="grid content-start gap-4">
        <article className="rounded-lg border border-line bg-white p-4 shadow-card">
          <div className="flex items-center gap-2">
            <ShieldAlert aria-hidden="true" className="h-5 w-5 text-red" />
            <h3 className="font-semibold">Observed chain</h3>
          </div>
          <ChainList good={false} items={scenario.guardrail.unsafe} marked={scenario.guardrail.unsafeBad} />
        </article>
        <article className="rounded-lg border border-line bg-white p-4 shadow-card">
          <div className="flex items-center gap-2">
            <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-green" />
            <h3 className="font-semibold">Recommended chain</h3>
          </div>
          <ChainList good items={scenario.guardrail.guarded} marked={scenario.guardrail.guardedGood} />
        </article>
        <article className="rounded-lg border border-line bg-[#fdf1dc] p-4 text-sm leading-6 text-[#6f4d12] shadow-card">
          {scenario.guardrail.rec}
        </article>
      </aside>
    </section>
  );
}

function ChainList({ good, items, marked }: { good: boolean; items: string[]; marked: boolean[] }) {
  return (
    <ol className="mt-3 grid gap-2">
      {items.map((item, index) => (
        <li className="flex gap-2 text-sm leading-5" key={item}>
          <span className="font-mono text-xs text-soft">{index + 1}</span>
          <span style={{ color: marked[index] ? (good ? "#22574a" : "#a83a2c") : "#74777d" }}>{item}</span>
        </li>
      ))}
    </ol>
  );
}

function ReportCard({ scenario }: { scenario: Scenario }) {
  return (
    <section className="mx-auto max-w-4xl rounded-lg border border-line bg-white p-6 shadow-card print:shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-row pb-5">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase text-muted">Incident report</p>
          <h2 className="mt-2 text-3xl font-semibold">{scenario.app}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{scenario.summary}</p>
        </div>
        <Pill bg={toneForDecision(scenario.decision).bg} tx={toneForDecision(scenario.decision).tx}>{scenario.decision}</Pill>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Incident", scenario.id],
          ["Severity", scenario.severity],
          ["Mode", scenario.mode],
          ["Duration", scenario.dur],
        ].map(([label, value]) => (
          <div className="rounded-lg border border-line bg-paper p-3" key={label}>
            <p className="font-mono text-[11px] text-muted">{label}</p>
            <p className="mt-2 font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <article>
          <h3 className="font-semibold">Security path</h3>
          <ol className="mt-3 grid gap-2">
            {scenario.steps.map((step, index) => (
              <li className="grid grid-cols-[2rem_1fr] gap-3 text-sm" key={`${step.t}-${step.title}`}>
                <span className="font-mono text-xs text-muted">{pad(index + 1)}</span>
                <span>{step.title}</span>
              </li>
            ))}
          </ol>
        </article>
        <article>
          <h3 className="font-semibold">Policy decisions</h3>
          <div className="mt-3 grid gap-2">
            {scenario.policies.map((policy) => (
              <div className="rounded-lg border border-line bg-paper p-3" key={`${policy.t}-${policy.rule}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <Pill bg={(toneForDecision(policy.decision)).bg} tx={(toneForDecision(policy.decision)).tx}>
                    {policy.decision}
                  </Pill>
                  <span className="font-mono text-xs text-muted">{policy.t}</span>
                </div>
                <p className="mt-2 text-sm font-semibold">{policy.rule}</p>
                <p className="mt-1 text-sm leading-5 text-muted">{policy.reason}</p>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

function Pill({ bg, children, tx }: { bg: string; children: React.ReactNode; tx: string }) {
  return (
    <span className="inline-flex w-fit items-center rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold" style={{ background: bg, color: tx }}>
      {children}
    </span>
  );
}

function toneForDecision(decision: string): { bg: string; tx: string } {
  return decisionTone[decision] ?? defaultDecisionTone;
}

function IconButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      aria-label={label}
      className="grid h-9 w-9 place-items-center rounded-md border border-line bg-white text-muted transition hover:text-ink"
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function scenarioFromTrace(run: TraceRun, findings: Finding[]): Scenario {
  const timeline = toTimeline(run);
  const firstFinding = findings[0];
  const decision = run.events.some((event) => event.type === "policy.decision" && event.decision === "blocked")
    ? "Blocked"
    : findings.length > 0
      ? "Detected"
      : "Prevented";
  const sourceNodes: ScenarioNode[] = [];
  const modelNodes: ScenarioNode[] = [];
  const toolNodes: ScenarioNode[] = [];
  const policyNodes: ScenarioNode[] = [];
  const edges: ScenarioEdge[] = [];
  const nodeIds = new Set<string>();
  let sourceCount = 0;
  let modelCount = 0;
  let toolCount = 0;
  let policyCount = 0;

  run.events.forEach((event, index) => {
    if (event.type === "source.read") {
      const sourceLane = event.source.trust === "untrusted" ? 0.74 : laneY(sourceCount, [0.2, 0.42]);
      sourceCount += 1;
      sourceNodes.push({
        id: event.source.id,
        label: event.source.label,
        sub: `${event.source.kind} · ${event.source.dataClass}`,
        kind: event.source.trust === "untrusted" ? "untrusted" : "trusted",
        at: index,
        x: 0.12,
        y: sourceLane,
      });
      nodeIds.add(event.source.id);
    }

    if (event.type === "model.step") {
      const modelLane = laneY(modelCount, [0.5, 0.28, 0.72]);
      modelCount += 1;
      modelNodes.push({
        id: event.id,
        label: event.step.label,
        sub: event.step.plannedTool ? `plans ${event.step.plannedTool}` : "agent reasoning",
        kind: "model",
        at: index,
        x: 0.4,
        y: modelLane,
      });
      nodeIds.add(event.id);
      event.step.influencedBy.forEach((sourceId) => {
        if (nodeIds.has(sourceId)) {
          edges.push({ f: sourceId, t: event.id, at: index, taint: sourceIsUntrusted(run, sourceId) });
        }
      });
    }

    if (event.type === "tool.call") {
      const isProtectedTool = event.tool.targetClass === "protected" || event.tool.targetClass === "secret";
      const toolLane = laneY(toolCount, [0.3, 0.7, 0.5]);
      toolCount += 1;
      toolNodes.push({
        id: event.id,
        label: event.tool.name,
        sub: `${event.tool.boundary} · ${event.tool.target}`,
        kind: event.tool.destinationClass === "external" ? "external" : isProtectedTool ? "protected" : "tool",
        at: index,
        x: event.tool.destinationClass === "external" ? 0.68 : 0.62,
        y: toolLane,
      });
      nodeIds.add(event.id);
      event.tool.influencedBy.forEach((influenceId) => {
        if (nodeIds.has(influenceId)) {
          edges.push({
            f: influenceId,
            t: event.id,
            at: index,
            taint: sourceIsUntrusted(run, influenceId) || findings.some((finding) => finding.evidenceEventIds.includes(event.id)),
          });
        }
      });
    }

    if (event.type === "policy.decision" || event.type === "violation.detected") {
      const policyLane = laneY(policyCount, [0.24, 0.54, 0.82]);
      policyCount += 1;
      policyNodes.push({
        id: event.id,
        label: event.type === "policy.decision" ? `Policy ${event.decision}` : labelViolation(event.violation.type),
        sub: event.type === "policy.decision" ? event.reason : event.violation.severity,
        kind: "policy",
        at: index,
        x: 0.88,
        y: policyLane,
      });
      nodeIds.add(event.id);

      const previousTool = [...toolNodes].reverse()[0];
      if (previousTool) {
        edges.push({
          f: previousTool.id,
          t: event.id,
          at: index,
          taint: true,
          blocked: event.type === "policy.decision" && event.decision === "blocked",
        });
      }
    }
  });

  const fallbackNode: ScenarioNode = {
    id: "run",
    label: run.app,
    sub: "trace run",
    kind: "trusted",
    at: 0,
    x: 0.08,
    y: 0.43,
  };

  return {
    id: run.id || "INC-0042",
    app: run.app,
    violation: firstFinding ? labelViolation(firstFinding.type) : "No violation",
    severity: (firstFinding?.severity.toUpperCase() as Scenario["severity"] | undefined) ?? "LOW",
    decision,
    when: formatShortDate(run.startedAt),
    dur: durationLabel(run),
    mode: "SDK",
    predicates: findings.length > 0 ? findings.map((finding) => labelViolation(finding.type)) : ["metadata-only", run.captureMode],
    summary:
      firstFinding?.summary ??
      "No deterministic unsafe influence chain was detected in this replay. The trace still shows sources, model steps, tool calls, and policy boundaries.",
    nodes: [...sourceNodes, ...modelNodes, ...toolNodes, ...policyNodes].length > 0 ? [...sourceNodes, ...modelNodes, ...toolNodes, ...policyNodes] : [fallbackNode],
    edges,
    steps: timeline.map((item) => {
      const decision =
        item.event.type === "policy.decision"
          ? titleCase(item.event.decision)
          : item.event.type === "violation.detected"
            ? "Violation"
            : undefined;

      return {
        t: formatTime(item.event.timestamp),
        kind: stepKind(item.event),
        title: item.title,
        detail: item.subtitle,
        ...(decision ? { decision } : {}),
      };
    }),
    policies: run.events
      .filter((event) => event.type === "policy.decision" || event.type === "violation.detected")
      .map((event) =>
        event.type === "policy.decision"
          ? {
              t: formatTime(event.timestamp),
              rule: "runtime policy",
              target: event.targetEventId,
              decision: titleCase(event.decision),
              reason: event.reason,
            }
          : {
              t: formatTime(event.timestamp),
              rule: `predicate: ${event.violation.type}`,
              target: event.violation.evidenceEventIds.at(-1) ?? run.id,
              decision: "Violation",
              reason: event.violation.recommendation,
            },
      ),
    guardrail: guardrailFromFinding(firstFinding),
    isLive: true,
  };
}

function guardrailFromFinding(finding: Finding | undefined): GuardrailSpec {
  if (!finding) {
    return {
      unsafe: ["Trace captured", "Sources labeled", "Tools inspected", "Policies evaluated", "No unsafe chain detected"],
      unsafeBad: [false, false, false, false, false],
      guarded: ["Trace captured", "Sources labeled", "Tools inspected", "Policies evaluated", "No unsafe chain detected"],
      guardedGood: [true, true, true, true, true],
      rec: "Keep source trust labels and tool boundary metadata complete so future violations are visible at replay time.",
    };
  }

  const label = labelViolation(finding.type);
  return {
    unsafe: ["Trusted task begins", "Untrusted source enters context", "Agent plan carries unsafe influence", `${label} boundary reached`, "Detector raises incident"],
    unsafeBad: [false, true, true, true, true],
    guarded: ["Trusted task begins", "Untrusted source is labeled as data", "Unsafe influence is stripped or held", "Boundary requires approval", "Safe outcome recorded"],
    guardedGood: [false, true, true, true, true],
    rec: finding.recommendation,
  };
}

function sourceIsUntrusted(run: TraceRun, sourceId: string): boolean {
  return run.events.some((event) => event.type === "source.read" && event.source.id === sourceId && event.source.trust === "untrusted");
}

function stepKind(event: TraceEvent): StepKind {
  if (event.type === "source.read" || event.type === "trace.start") {
    return "source";
  }

  if (event.type === "model.step") {
    return "model";
  }

  if (event.type === "tool.call") {
    return event.tool.targetClass === "protected" || event.tool.targetClass === "secret" ? "data" : "tool";
  }

  if (event.type === "policy.decision") {
    return "policy";
  }

  return "violation";
}

function screenTitle(screen: Screen): string {
  const titles: Record<Screen, string> = {
    board: "Incidents",
    replay: "Replay",
    policy: "Policy log",
    guard: "Guardrails",
    report: "Incident report",
  };

  return titles[screen];
}

function scenarioReport(scenario: Scenario): string {
  return [
    `# Agent Breach Replay Report: ${scenario.app}`,
    "",
    `**Incident:** ${scenario.id}`,
    `**Decision:** ${scenario.decision}`,
    `**Severity:** ${scenario.severity}`,
    "",
    "## Summary",
    scenario.summary,
    "",
    "## Security Path",
    ...scenario.steps.map((step, index) => `${index + 1}. **${step.title}**: ${step.detail}`),
    "",
    "## Recommendation",
    scenario.guardrail.rec,
    "",
  ].join("\n");
}

function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "Now";
  }

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return value;
  }

  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

function durationLabel(run: TraceRun): string {
  if (!run.endedAt) {
    return "open";
  }

  const start = new Date(run.startedAt).valueOf();
  const end = new Date(run.endedAt).valueOf();
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return "open";
  }

  return `${Math.max(0, (end - start) / 1000).toFixed(1)}s`;
}

function laneY(index: number, lanes: number[]): number {
  return lanes[index % lanes.length] ?? 0.5;
}

function titleCase(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function edgePort(
  from: { x: number; y: number },
  to: { x: number; y: number },
  width: number,
  height: number,
): { x: number; y: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const horizontal = Math.abs(dx) >= Math.abs(dy);

  if (horizontal) {
    return {
      x: from.x + (dx >= 0 ? width / 2 : -width / 2),
      y: from.y,
    };
  }

  return {
    x: from.x,
    y: from.y + (dy >= 0 ? height / 2 : -height / 2),
  };
}

async function readApiError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? `Request failed with status ${response.status}.`;
  } catch {
    return `Request failed with status ${response.status}.`;
  }
}
