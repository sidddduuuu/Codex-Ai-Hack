import { NextResponse } from "next/server";
import { traceStoreResponse } from "../../../lib/server/apiResponses";
import { MissingSupabaseConfigError } from "../../../lib/server/supabase";
import { isSupabaseConfigured, listTraceRuns } from "../../../lib/server/traceStore";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ configured: false, runs: [], total: 0, limit: 20, offset: 0 });
  }

  try {
    const url = new URL(request.url);
    const limit = parsePositiveInt(url.searchParams.get("limit"), 20);
    const offset = parsePositiveInt(url.searchParams.get("offset"), 0);
    const page = await listTraceRuns(limit, offset);

    return NextResponse.json({ configured: true, ...page });
  } catch (error) {
    if (error instanceof MissingSupabaseConfigError) {
      return NextResponse.json({ configured: false, runs: [], total: 0, limit: 20, offset: 0 });
    }

    return traceStoreResponse(error);
  }
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
