"use client";

import { runDetectors } from "@agent-breach/detectors";
import { vendorEmailTrace } from "@agent-breach/trace-schema/fixtures/vendor-email";
import { AlertTriangle, Database, Download, FileJson, Play, Shield, Workflow } from "lucide-react";
import { useMemo, useState } from "react";
import { MetricCard } from "../components/MetricCard";
import { PredicatePanel } from "../components/PredicatePanel";
import { ReplayTimeline } from "../components/ReplayTimeline";
import { TraceGraph } from "../components/TraceGraph";
import { TraceInspector } from "../components/TraceInspector";
import { generateMarkdownReport, toTimeline } from "../lib/replay";

export default function Home() {
  const run = vendorEmailTrace;
  const findings = useMemo(() => runDetectors(run), [run]);
  const steps = useMemo(() => toTimeline(run), [run]);
  const [activeStep, setActiveStep] = useState(steps.length - 1);
  const activeEvent = steps[activeStep]?.event ?? steps[0]?.event;
  const report = useMemo(() => generateMarkdownReport(run, findings), [findings, run]);

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

  return (
    <main className="mx-auto grid w-full max-w-[1500px] gap-5 overflow-hidden px-4 py-6 sm:px-5 lg:px-8">
      <header className="min-w-0 rounded-lg border border-line bg-panel p-6 shadow-panel">
        <div className="flex min-w-0 flex-wrap gap-2">
          <span className="rounded-full border border-line bg-panel-2 px-3 py-1 text-sm text-muted">v0.1 Local Replay</span>
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
        <MetricCard detail="No raw payloads required for this local replay." icon={Shield} label="Capture mode" tone="green" value={run.captureMode} />
      </section>

      <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid min-w-0 gap-5">
          <TraceGraph findings={findings} run={run} />
          <ReplayTimeline activeStep={activeStep} steps={steps} />
        </div>
        <div className="grid min-w-0 content-start gap-5">
          <PredicatePanel findings={findings} />
          <section className="rounded-lg border border-line bg-panel p-4 shadow-panel">
            <div className="mb-3 flex items-center gap-2">
              <Database aria-hidden="true" className="h-5 w-5 text-breach-cyan" />
              <h2 className="text-lg font-semibold">Storage posture</h2>
            </div>
            <p className="text-sm leading-6 text-muted">
              This first build reads a local JSON-compatible trace. The next platform slice can persist
              runs, events, findings, policies, and reports in Supabase Postgres after the schema settles.
            </p>
          </section>
        </div>
      </section>

      <TraceInspector event={activeEvent} />
    </main>
  );
}
