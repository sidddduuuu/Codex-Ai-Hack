import { NextResponse } from "next/server";
import { rateLimit, requireIngestKey } from "../../../lib/server/apiGuard";
import { traceStoreResponse } from "../../../lib/server/apiResponses";
import { MissingSupabaseConfigError } from "../../../lib/server/supabase";
import { isSupabaseConfigured, listTraceRuns, saveTraceRun } from "../../../lib/server/traceStore";

export const runtime = "nodejs";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ configured: false, runs: [] });
  }

  try {
    const page = await listTraceRuns();
    return NextResponse.json({ configured: true, runs: page.runs, total: page.total });
  } catch (error) {
    if (error instanceof MissingSupabaseConfigError) {
      return NextResponse.json({ configured: false, runs: [] });
    }

    return traceStoreResponse(error);
  }
}

export async function POST(request: Request) {
  const unauthorized = requireIngestKey(request);
  if (unauthorized) {
    return unauthorized;
  }

  const limited = rateLimit(request, "store-trace", 30);
  if (limited) {
    return limited;
  }

  try {
    const body = await request.json();
    const result = await saveTraceRun(getTracePayload(body));

    return NextResponse.json(
      {
        runId: result.run.id,
        eventCount: result.eventCount,
        findings: result.findings,
      },
      { status: 201 },
    );
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
