import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../lib/auth/requireAdmin";

export async function GET(request: NextRequest) {
  try {
    console.log("Test API: Starting");
    const authResult = await requireAdmin(request);
    console.log("Test API: Auth result type:", typeof authResult);

    if (authResult instanceof NextResponse) {
      console.log("Test API: Auth failed, returning error");
      return authResult;
    }

    console.log("Test API: Auth successful for:", authResult.fullName);
    return NextResponse.json({
      success: true,
      user: authResult,
      message: "Authentication successful!",
    });
  } catch (error) {
    console.error("Test API error:", error);
    return NextResponse.json(
      {
        error:
          "Internal server error: " +
          (error instanceof Error ? error.message : "Unknown"),
      },
      { status: 500 }
    );
  }
}
