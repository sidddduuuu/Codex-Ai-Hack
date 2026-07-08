import { NextResponse } from "next/server";
import { MissingSupabaseConfigError } from "./supabase";
import { TraceStoreError, TraceValidationError } from "./traceStore";

export function traceStoreResponse(error: unknown): NextResponse {
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
