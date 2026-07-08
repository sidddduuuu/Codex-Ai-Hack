import { motion } from "framer-motion";
import type { TimelineStep } from "../lib/replay";

const toneClasses: Record<TimelineStep["tone"], string> = {
  blue: "border-breach-blue/45 bg-breach-blue/10",
  green: "border-breach-green/45 bg-breach-green/10",
  yellow: "border-breach-yellow/45 bg-breach-yellow/10",
  red: "border-breach-red/45 bg-breach-red/10",
  violet: "border-breach-violet/45 bg-breach-violet/10",
  muted: "border-line bg-panel-2",
};

export function ReplayTimeline({ activeStep, steps }: { activeStep: number; steps: TimelineStep[] }) {
  return (
    <section className="min-w-0 rounded-lg border border-line bg-panel p-4 shadow-panel">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-normal text-breach-violet">Replay timeline</p>
          <h2 className="mt-1 text-xl font-semibold">
            Step {Math.min(activeStep + 1, steps.length)} of {steps.length}
          </h2>
        </div>
        <div className="h-2 w-48 overflow-hidden rounded-full bg-panel-2">
          <div
            className="h-full rounded-full bg-breach-cyan transition-all"
            style={{ width: `${((activeStep + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>
      <ol className="grid gap-3">
        {steps.map((step) => {
          const isVisible = step.index - 1 <= activeStep;
          return (
            <motion.li
              animate={{ opacity: isVisible ? 1 : 0.34, y: isVisible ? 0 : 4 }}
              className={`grid grid-cols-[2.5rem_1fr] gap-3 rounded-lg border p-3 ${toneClasses[step.tone]}`}
              initial={false}
              key={step.id}
            >
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-slate-950/70 font-bold">
                {step.index}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-950/60 px-2 py-1 text-xs font-semibold text-muted">
                    {step.badge}
                  </span>
                  <h3 className="font-semibold text-ink">{step.title}</h3>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted">{step.subtitle}</p>
              </div>
            </motion.li>
          );
        })}
      </ol>
    </section>
  );
}
