import type { TraceEvent } from "@agent-breach/trace-schema";

export function TraceInspector({ event }: { event: TraceEvent }) {
  return (
    <section className="min-w-0 rounded-lg border border-line bg-panel p-4 shadow-panel">
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-normal text-breach-violet">Trace inspector</p>
        <h2 className="mt-1 text-xl font-semibold">{event.type}</h2>
      </div>
      <pre className="max-h-[360px] overflow-auto rounded-lg border border-line bg-slate-950/70 p-4 text-sm leading-6 text-muted">
        {JSON.stringify(event, null, 2)}
      </pre>
    </section>
  );
}
