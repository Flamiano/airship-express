import { NextRequest, NextResponse } from "next/server";
import { getEvidenceFileUrl } from "@/performance-development-dashboard/lib/performance/goalEvidence";

export const dynamic = "force-dynamic";

/**
 * Serves an authorized evidence attachment by redirecting the browser to a
 * fresh short-lived signed URL. File content is never proxied through this
 * route and the underlying storage path is never exposed to the client.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ evidenceId: string }> }
) {
  try {
    const { evidenceId } = await params;

    const result = await getEvidenceFileUrl(evidenceId);
    if (result instanceof NextResponse) return result;

    return NextResponse.redirect(result.fileUrl);
  } catch (error) {
    console.error(
      "GET /api/performance/evidence/[evidenceId]/file error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}