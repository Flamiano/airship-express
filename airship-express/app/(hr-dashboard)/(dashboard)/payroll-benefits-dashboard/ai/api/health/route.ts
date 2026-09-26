import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";
import { AI_CONFIG } from "../../config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  return NextResponse.json({
    providers: {
      groq: {
        configured: !!AI_CONFIG.groq.apiKey,
        model: AI_CONFIG.groq.model,
      },
      deepseek: {
        configured: !!AI_CONFIG.deepseek.apiKey,
        model: AI_CONFIG.deepseek.model,
      },
      gemini: {
        configured: !!AI_CONFIG.gemini.apiKey,
        model: AI_CONFIG.gemini.model,
      },
    },
    timestamp: new Date().toISOString(),
  });
}
