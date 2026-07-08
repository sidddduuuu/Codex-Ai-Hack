import { NextResponse } from "next/server";
import { traceStoreResponse } from "../../../../../lib/server/apiResponses";
import { getTraceRun } from "../../../../../lib/server/traceStore";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await context.params;
    const storedRun = await getTraceRun(runId);

    if (!storedRun) {
      return NextResponse.json({ error: "Trace run not found." }, { status: 404 });
    }

    // { run } is the same envelope POST /api/traces accepts, so exports re-import as-is.
    return NextResponse.json(
      { run: storedRun.run, findings: storedRun.findings },
      {
        headers: {
          "content-disposition": `attachment; filename="${sanitizeFilename(runId)}.trace.json"`,
        },
      },
    );
  } catch (error) {
    return traceStoreResponse(error);
  }
}

function sanitizeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}
