import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "../../../../payroll-benefits-dashboard/lib/auth/requireAdmin";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("hr4_pagibig_tiers")
    .select("*")
    .eq("is_active", true)
    .order("salary_min", { ascending: true });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await request.json();
    const { data, error } = await supabaseAdmin
      .from("hr4_pagibig_tiers")
      .insert([body])
      .select();

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
