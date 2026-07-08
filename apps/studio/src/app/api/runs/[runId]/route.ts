import { NextResponse } from "next/server";
import { rateLimit, requireIngestKey } from "../../../../lib/server/apiGuard";
import { traceStoreResponse } from "../../../../lib/server/apiResponses";
import { deleteTraceRun, getTraceRun } from "../../../../lib/server/traceStore";

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
    return traceStoreResponse(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ runId: string }> }) {
  const unauthorized = requireIngestKey(request);
  if (unauthorized) {
    return unauthorized;
  }

  const limited = rateLimit(request, "delete-run", 30);
  if (limited) {
    return limited;
  }

  try {
    const { runId } = await context.params;
    const deleted = await deleteTraceRun(runId);

    if (!deleted) {
      return NextResponse.json({ error: "Trace run not found." }, { status: 404 });
    }

    return NextResponse.json({ deleted: true, runId });
  } catch (error) {
    return traceStoreResponse(error);
  }
}
