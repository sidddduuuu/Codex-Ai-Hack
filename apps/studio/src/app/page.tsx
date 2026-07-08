"use client";

import { runDetectors } from "@agent-breach/detectors";
import type { Finding, TraceRun } from "@agent-breach/trace-schema";
import { vendorEmailTrace } from "@agent-breach/trace-schema/fixtures/vendor-email";
import { AlertTriangle, Database, Download, FileJson, Play, Shield, UploadCloud, Workflow } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MetricCard } from "../components/MetricCard";
import { PredicatePanel } from "../components/PredicatePanel";
import { ReplayTimeline } from "../components/ReplayTimeline";
import { TraceGraph } from "../components/TraceGraph";
import { TraceInspector } from "../components/TraceInspector";
import { generateMarkdownReport, toTimeline } from "../lib/replay";

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

export default function Home() {
  const [run, setRun] = useState<TraceRun>(vendorEmailTrace);
  const [storedFindings, setStoredFindings] = useState<Finding[] | undefined>();
  const [storedRuns, setStoredRuns] = useState<StoredTraceSummary[]>([]);
  const [storageStatus, setStorageStatus] = useState<StorageStatus>({
    state: "loading",
    message: "Checking Supabase metadata store.",
  });
  const [isSaving, setIsSaving] = useState(false);
  const findings = useMemo(() => storedFindings ?? runDetectors(run), [run, storedFindings]);
  const steps = useMemo(() => toTimeline(run), [run]);
  const [activeStep, setActiveStep] = useState(vendorEmailTrace.events.length - 1);
  const activeStepIndex = Math.min(activeStep, Math.max(steps.length - 1, 0));
  const activeEvent = steps[activeStepIndex]?.event ?? steps[0]?.event;
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
    setActiveStep(Math.max(steps.length - 1, 0));
  }, [run.id, steps.length]);

  if (!activeEvent) {
    return null;
  }

  function advanceReplay() {
    setActiveStep((current) => (current + 1 >= steps.length ? 0 : current + 1));
  }

  function downloadReport() {
    const blob = new Blob([report], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${run.id}-report.md`;
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

  const storageTone = storageStatus.state === "connected" ? "green" : storageStatus.state === "error" ? "red" : "yellow";

  return (
    <main className="mx-auto grid w-full max-w-[1500px] gap-5 overflow-hidden px-4 py-6 sm:px-5 lg:px-8">
      <header className="min-w-0 rounded-lg border border-line bg-panel p-6 shadow-panel">
        <div className="flex min-w-0 flex-wrap gap-2">
          <span className="rounded-full border border-line bg-panel-2 px-3 py-1 text-sm text-muted">v0.2 Backend Replay</span>
          <span className="rounded-full border border-breach-green/50 bg-breach-green/10 px-3 py-1 text-sm text-breach-green">
            Metadata-only trace
          </span>
          <span className="rounded-full border border-breach-violet/50 bg-breach-violet/10 px-3 py-1 text-sm text-breach-violet">
            Deterministic detectors
          </span>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h1 className="max-w-4xl break-words text-3xl font-bold tracking-normal sm:text-4xl md:text-6xl">
              Agent Breach Replay
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-muted">
              A security trace layer and replay studio that shows how untrusted content influenced
              privileged tool actions without requiring raw emails, files, prompts, or secrets.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <button
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-breach-cyan bg-breach-cyan px-4 font-semibold text-slate-950"
              onClick={advanceReplay}
              type="button"
            >
              <Play aria-hidden="true" className="h-4 w-4" />
              Replay step
            </button>
            <button
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line bg-panel-2 px-4 font-semibold text-ink"
              onClick={downloadReport}
              type="button"
            >
              <Download aria-hidden="true" className="h-4 w-4" />
              Export report
            </button>
          </div>
        </div>
      </header>

      <section className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard detail={run.app} icon={Workflow} label="Run" tone="blue" value={run.id} />
        <MetricCard detail="Security events captured from the sample agent path." icon={FileJson} label="Trace events" tone="violet" value={run.events.length} />
        <MetricCard detail="Deterministic rules triggered before any LLM explanation." icon={AlertTriangle} label="Findings" tone="red" value={findings.length} />
        <MetricCard detail={storageStatus.message} icon={Shield} label="Storage" tone={storageTone} value={storageStatus.state} />
      </section>

      <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid min-w-0 gap-5">
          <TraceGraph findings={findings} run={run} />
          <ReplayTimeline activeStep={activeStepIndex} steps={steps} />
        </div>
        <div className="grid min-w-0 content-start gap-5">
          <PredicatePanel findings={findings} />
          <section className="rounded-lg border border-line bg-panel p-4 shadow-panel">
            <div className="mb-3 flex items-center gap-2">
              <Database aria-hidden="true" className="h-5 w-5 text-breach-cyan" />
              <h2 className="text-lg font-semibold">Storage posture</h2>
            </div>
            <p className="text-sm leading-6 text-muted">
              Supabase stores run, event, and finding metadata through server API routes. The browser
              never receives the service role key, and metadata-only runs drop source previews before insert.
            </p>
            <div className="mt-4 rounded-lg border border-line bg-panel-2 p-3 text-sm leading-6 text-muted">
              <div className="font-semibold text-ink">{storedRuns.length} stored replay{storedRuns.length === 1 ? "" : "s"}</div>
              <div className="mt-1">{storageStatus.message}</div>
            </div>
            <button
              className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-breach-cyan bg-breach-cyan px-4 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSaving}
              onClick={storeSampleTrace}
              type="button"
            >
              <UploadCloud aria-hidden="true" className="h-4 w-4" />
              {isSaving ? "Storing trace" : "Store sample trace"}
            </button>
          </section>
        </div>
      </section>

      <TraceInspector event={activeEvent} />
    </main>
  );
}

async function readApiError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? `Request failed with status ${response.status}.`;
  } catch {
    return `Request failed with status ${response.status}.`;
  }
}
