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

    return NextResponse.json({ runId, findings: storedRun.findings });
  } catch (error) {
    return traceStoreResponse(error);
  }
}
