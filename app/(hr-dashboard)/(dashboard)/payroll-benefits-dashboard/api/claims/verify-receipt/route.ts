import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";
import { verifyReceipt } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/ai/actions/verifyReceipt";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const admin = authResult;

  try {
    const body = await request.json();
    const {
      employeeId,
      imageBase64,
      mimeType,
      claimedAmount,
      claimedDescription,
      claimedClaimType,
    } = body;

    if (!employeeId || !imageBase64 || !mimeType) {
      return NextResponse.json(
        { error: "employeeId, imageBase64, and mimeType are required." },
        { status: 400 }
      );
    }

    const result = await verifyReceipt({
      employeeId,
      imageBase64,
      mimeType,
      claimedAmount: Number(claimedAmount) || 0,
      claimedDescription: claimedDescription || "",
      claimedClaimType: claimedClaimType || "",
      verifiedByAdminId: admin.id ?? admin.adminId ?? "",
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("POST verify-receipt error:", err);
    return NextResponse.json(
      { error: err?.message || "Verification failed" },
      { status: 500 }
    );
  }
}
