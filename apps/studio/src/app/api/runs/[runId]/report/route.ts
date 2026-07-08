import { NextResponse } from "next/server";
import { traceStoreResponse } from "../../../../../lib/server/apiResponses";
import { generateMarkdownReport } from "../../../../../lib/replay";
import { getTraceRun } from "../../../../../lib/server/traceStore";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await context.params;
    const storedRun = await getTraceRun(runId);

    if (!storedRun) {
      return NextResponse.json({ error: "Trace run not found." }, { status: 404 });
    }

    const report = generateMarkdownReport(storedRun.run, storedRun.findings);

    return new NextResponse(report, {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": `attachment; filename="${sanitizeFilename(runId)}-report.md"`,
      },
    });
  } catch (error) {
    return traceStoreResponse(error);
  }
}

function sanitizeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}
