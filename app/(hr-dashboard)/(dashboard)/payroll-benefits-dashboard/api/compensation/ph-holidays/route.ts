import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NAGER_API = "https://date.nager.at/api/v3/PublicHolidays";

function normalizePHHoliday(raw: any) {
  const types: string[] = Array.isArray(raw.types) ? raw.types : [];
  let type: "regular" | "special_non_working" | "special_working" =
    "special_non_working";
  if (types.includes("Public")) type = "regular";
  return {
    holiday_date: raw.date,
    name: raw.localName || raw.name,
    type,
    year: Number(String(raw.date).slice(0, 4)),
    source: "nager.date",
  };
}

function isValidYear(value: number) {
  const current = new Date().getFullYear();
  return Number.isFinite(value) && value >= 2000 && value <= current;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const url = new URL(request.url);
    const requested = Number(
      url.searchParams.get("year") || new Date().getFullYear()
    );

    if (!isValidYear(requested)) {
      return NextResponse.json(
        {
          error: `Year must be between 2000 and ${new Date().getFullYear()}.`,
        },
        { status: 400 }
      );
    }

    const refresh = url.searchParams.get("refresh") === "true";

    const { data: existing } = await supabaseAdmin
      .from("hr4_ph_holidays")
      .select("*")
      .eq("year", requested)
      .eq("is_active", true)
      .order("holiday_date", { ascending: true });

    if (!refresh && existing && existing.length > 0) {
      return NextResponse.json(existing, {
        headers: { "Cache-Control": "no-store, max-age=0" },
      });
    }

    let fetched: any[] = [];
    let fetchError: string | null = null;

    try {
      const res = await fetch(`${NAGER_API}/${requested}/PH`, {
        cache: "no-store",
      });

      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json)) {
          fetched = json
            .map(normalizePHHoliday)
            .filter((h) => h.holiday_date && h.name);
        }
      } else if (res.status === 404) {
        fetchError = `No holiday data available for ${requested}.`;
      } else {
        fetchError = `Nager.Date returned ${res.status}.`;
      }
    } catch (err) {
      console.error("Nager fetch failed:", err);
      fetchError = "Unable to reach Nager.Date.";
    }

    if (fetched.length > 0) {
      const unique = Array.from(
        new Map(fetched.map((h) => [h.holiday_date, h])).values()
      );

      const { error: upErr } = await supabaseAdmin
        .from("hr4_ph_holidays")
        .upsert(unique, { onConflict: "holiday_date" });

      if (upErr) console.error("Holiday upsert error:", upErr);
    }

    const { data: rows, error } = await supabaseAdmin
      .from("hr4_ph_holidays")
      .select("*")
      .eq("year", requested)
      .eq("is_active", true)
      .order("holiday_date", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(rows || [], {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Fetch-Error": fetchError || "",
        "X-Records-Fetched": String(fetched.length),
      },
    });
  } catch (error) {
    console.error("GET /compensation/ph-holidays error:", error);
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
    const { holiday_date, name, type } = body;

    if (!holiday_date || !name || !type) {
      return NextResponse.json(
        { error: "holiday_date, name, and type are required." },
        { status: 400 }
      );
    }

    const year = Number(String(holiday_date).slice(0, 4));
    if (!isValidYear(year)) {
      return NextResponse.json(
        {
          error: `Holiday year must be between 2000 and ${new Date().getFullYear()}.`,
        },
        { status: 400 }
      );
    }

    if (type === "special_working") {
    }

    const { data, error } = await supabaseAdmin
      .from("hr4_ph_holidays")
      .upsert(
        {
          holiday_date,
          name,
          type,
          year,
          source: "manual",
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "holiday_date" }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("POST /compensation/ph-holidays error:", error);
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
      return NextResponse.json({ error: "id is required." }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("hr4_ph_holidays")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /compensation/ph-holidays error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
