import { NextResponse } from "next/server";
import { isIngestAuthEnabled } from "../../../lib/server/apiGuard";
import { isSupabaseConfigured } from "../../../lib/server/traceStore";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "agent-breach-studio",
    supabaseConfigured: isSupabaseConfigured(),
    ingestAuthEnabled: isIngestAuthEnabled(),
    traceTablePrefix: process.env.TRACE_TABLE_PREFIX?.trim() || null,
  });
}
