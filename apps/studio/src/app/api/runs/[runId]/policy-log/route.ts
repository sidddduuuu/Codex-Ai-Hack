import { NextResponse } from "next/server";
import { traceStoreResponse } from "../../../../../lib/server/apiResponses";
import { getTraceRun } from "../../../../../lib/server/traceStore";

export const runtime = "nodejs";

interface PolicyLogEntry {
  eventId: string;
  timestamp: string;
  kind: "policy" | "violation";
  decision: string;
  reason: string;
  target?: string;
  violationType?: string;
  severity?: string;
  evidenceEventIds?: string[];
}

export async function GET(_request: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await context.params;
    const storedRun = await getTraceRun(runId);

    if (!storedRun) {
      return NextResponse.json({ error: "Trace run not found." }, { status: 404 });
    }

    const entries = storedRun.run.events.flatMap((event): PolicyLogEntry[] => {
      if (event.type === "policy.decision") {
        return [
          {
            eventId: event.id,
            timestamp: event.timestamp,
            kind: "policy" as const,
            decision: event.decision,
            target: event.targetEventId,
            reason: event.reason,
          },
        ];
      }

      if (event.type === "violation.detected") {
        return [
          {
            eventId: event.id,
            timestamp: event.timestamp,
            kind: "violation" as const,
            decision: "violation",
            violationType: event.violation.type,
            severity: event.violation.severity,
            evidenceEventIds: event.violation.evidenceEventIds,
            reason: event.violation.recommendation,
          },
        ];
      }

      return [];
    });

    return NextResponse.json({ runId, entries });
  } catch (error) {
    return traceStoreResponse(error);
  }
}
