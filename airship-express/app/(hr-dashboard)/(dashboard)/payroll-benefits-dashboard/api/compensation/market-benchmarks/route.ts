import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { data: benchmarks, error } = await supabaseAdmin
      .from("hr4_compen_market_benchmarks")
      .select("*")
      .eq("is_active", true)
      .order("survey_year", { ascending: false });

    if (error) {
      console.error("Error fetching market benchmarks:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(benchmarks || []);
  } catch (error) {
    console.error("GET /compensation/market-benchmarks error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();

    const { data: benchmark, error } = await supabaseAdmin
      .from("hr4_compen_market_benchmarks")
      .insert({
        job_title: body.job_title,
        industry: body.industry || null,
        location: body.location || null,
        min_salary: body.min_salary,
        mid_salary: body.mid_salary,
        max_salary: body.max_salary,
        percentile_25: body.percentile_25 || null,
        percentile_50: body.percentile_50 || null,
        percentile_75: body.percentile_75 || null,
        data_source: body.data_source || null,
        survey_year: body.survey_year,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating market benchmark:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(benchmark, { status: 201 });
  } catch (error) {
    console.error("POST /compensation/market-benchmarks error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "id parameter is required" },
        { status: 400 }
      );
    }

    const body = await request.json();

    const { data: benchmark, error } = await supabaseAdmin
      .from("hr4_compen_market_benchmarks")
      .update({
        job_title: body.job_title,
        industry: body.industry || null,
        location: body.location || null,
        min_salary: body.min_salary,
        mid_salary: body.mid_salary,
        max_salary: body.max_salary,
        percentile_25: body.percentile_25 || null,
        percentile_50: body.percentile_50 || null,
        percentile_75: body.percentile_75 || null,
        data_source: body.data_source || null,
        survey_year: body.survey_year,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating market benchmark:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(benchmark);
  } catch (error) {
    console.error("PUT /compensation/market-benchmarks error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "id parameter is required" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("hr4_compen_market_benchmarks")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting market benchmark:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /compensation/market-benchmarks error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
