import { NextResponse } from "next/server";
import { isSupabaseConfigured, listTraceRuns, TraceStoreError } from "../../../lib/server/traceStore";
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
    if (error instanceof MissingSupabaseConfigError) {
      return NextResponse.json({ configured: false, runs: [] });
    }

    if (error instanceof TraceStoreError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: "Unexpected trace store error." }, { status: 500 });
  }
}
