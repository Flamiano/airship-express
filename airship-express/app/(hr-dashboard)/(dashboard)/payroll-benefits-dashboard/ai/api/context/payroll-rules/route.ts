import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";
import type {
  SSSBracket,
  PhilHealthRate,
  PagibigTier,
} from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const [
      { data: sssBrackets },
      { data: philhealthRates },
      { data: pagibigTiers },
    ] = await Promise.all([
      supabaseAdmin
        .from("hr4_sss_brackets")
        .select("*")
        .eq("is_active", true)
        .order("range_min", { ascending: true }),
      supabaseAdmin
        .from("hr4_philhealth_rates")
        .select("*")
        .eq("is_active", true)
        .order("base_min_salary", { ascending: true }),
      supabaseAdmin
        .from("hr4_pagibig_tiers")
        .select("*")
        .eq("is_active", true)
        .order("salary_min", { ascending: true }),
    ]);

    return NextResponse.json(
      {
        sss_brackets: (sssBrackets || []) as SSSBracket[],
        philhealth_rates: (philhealthRates || []) as PhilHealthRate[],
        pagibig_tiers: (pagibigTiers || []) as PagibigTier[],
        fetched_at: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error: any) {
    console.error("GET ai/api/context/payroll-rules error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
