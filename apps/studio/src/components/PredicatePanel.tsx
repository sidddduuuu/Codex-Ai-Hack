import type { Finding, ViolationType } from "@agent-breach/trace-schema";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { labelViolation } from "../lib/replay";

const predicates: ViolationType[] = [
  "exfiltration",
  "untrusted_to_action",
  "confused_deputy",
  "destructive_write",
];

export function PredicatePanel({ findings }: { findings: Finding[] }) {
  return (
    <section className="min-w-0 rounded-lg border border-line bg-panel p-4 shadow-panel">
      <div className="mb-4 flex items-center gap-2">
        <ShieldAlert aria-hidden="true" className="h-5 w-5 text-breach-yellow" />
        <h2 className="text-lg font-semibold">Security predicates</h2>
      </div>
      <div className="grid gap-3">
        {predicates.map((predicate) => {
          const finding = findings.find((item) => item.type === predicate);
          return (
            <article
              className={`rounded-lg border p-3 ${
                finding ? "border-breach-red/45 bg-breach-red/10" : "border-line bg-panel-2"
              }`}
              key={predicate}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{labelViolation(predicate)}</h3>
                  <p className="mt-1 text-sm leading-5 text-muted">
                    {finding?.summary ?? "No matching unsafe influence chain in this trace."}
                  </p>
                </div>
                {finding ? (
                  <AlertTriangle aria-label="triggered" className="h-5 w-5 shrink-0 text-breach-red" />
                ) : (
                  <CheckCircle2 aria-label="quiet" className="h-5 w-5 shrink-0 text-breach-green" />
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
