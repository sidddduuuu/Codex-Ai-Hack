import { NextResponse } from "next/server";
import { getTraceRun, TraceStoreError, TraceValidationError } from "../../../../lib/server/traceStore";
import { MissingSupabaseConfigError } from "../../../../lib/server/supabase";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await context.params;
    const storedRun = await getTraceRun(runId);

    if (!storedRun) {
      return NextResponse.json({ error: "Trace run not found." }, { status: 404 });
    }

    return NextResponse.json(storedRun);
  } catch (error) {
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
}
