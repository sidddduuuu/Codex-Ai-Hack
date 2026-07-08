import { NextResponse } from "next/server";
import {
  isSupabaseConfigured,
  listTraceRuns,
  saveTraceRun,
  TraceStoreError,
  TraceValidationError,
} from "../../../lib/server/traceStore";
import { MissingSupabaseConfigError } from "../../../lib/server/supabase";

export const runtime = "nodejs";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ configured: false, runs: [] });
  }

  try {
    const runs = await listTraceRuns();
    return NextResponse.json({ configured: true, runs });
  } catch (error) {
    return traceStoreResponse(error);
  }
}

export async function POST(request: Request) {
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

function traceStoreResponse(error: unknown) {
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (error instanceof TraceValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof MissingSupabaseConfigError) {
    return NextResponse.json({ error: "Supabase metadata store is not configured." }, { status: 503 });
  }

  if (error instanceof TraceStoreError) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ error: "Unexpected trace store error." }, { status: 500 });
}
