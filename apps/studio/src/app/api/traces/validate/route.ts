import { NextResponse } from "next/server";
import { rateLimit } from "../../../../lib/server/apiGuard";
import { traceStoreResponse } from "../../../../lib/server/apiResponses";
import { validateTraceRun } from "../../../../lib/server/traceStore";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const limited = rateLimit(request, "validate", 60);
  if (limited) {
    return limited;
  }

  try {
    const body = await request.json();
    const result = validateTraceRun(getTracePayload(body));

    return NextResponse.json({
      valid: true,
      runId: result.run.id,
      app: result.run.app,
      agent: result.run.agent,
      captureMode: result.run.captureMode,
      eventCount: result.eventCount,
      findings: result.findings,
    });
  } catch (error) {
    return traceStoreResponse(error);
  }
}

function getTracePayload(body: unknown): unknown {
  if (typeof body === "object" && body !== null && "run" in body) {
    return (body as { run: unknown }).run;
  }

  return body;
}
