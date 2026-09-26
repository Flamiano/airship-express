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

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const fmt = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    const startStr = fmt(monthStart);
    const endStr = fmt(monthEnd);

    const { data: holidaysRaw, error: holErr } = await supabaseAdmin
      .from("hr4_ph_holidays")
      .select("holiday_date, name")
      .eq("is_active", true)
      .gte("holiday_date", startStr)
      .lte("holiday_date", endStr);

    if (holErr) console.error("calendar-events holidays error:", holErr);

    const holidays = (holidaysRaw ?? []).map((h: any) => ({
      date: h.holiday_date,
      label: h.name,
      kind: "holiday" as const,
    }));

    const { data: runsRaw, error: runsErr } = await supabaseAdmin
      .from("hr4_payroll_runs")
      .select("id, period_start, period_end")
      .lte("period_start", endStr)
      .gte("period_end", startStr);

    if (runsErr) console.error("calendar-events runs error:", runsErr);

    const periods: { date: string; label: string; kind: "period" }[] = [];
    const paydays: { date: string; label: string; kind: "payday" }[] = [];

    (runsRaw ?? []).forEach((r: any) => {
      const ref = `PR-${String(r.id).padStart(4, "0")}`;
      if (r.period_start) {
        periods.push({
          date: r.period_start,
          label: `Period start · ${ref}`,
          kind: "period",
        });
      }
      if (r.period_end) {
        periods.push({
          date: r.period_end,
          label: `Period end · ${ref}`,
          kind: "period",
        });
        paydays.push({
          date: r.period_end,
          label: `Payday · ${ref}`,
          kind: "payday",
        });
      }
    });

    const { data: empsRaw, error: empErr } = await supabaseAdmin
      .from("hr1_employees")
      .select("first_name, last_name, date_hired, status")
      .eq("status", "active")
      .not("date_hired", "is", null);

    if (empErr) console.error("calendar-events employees error:", empErr);

    const anniversaries: {
      date: string;
      label: string;
      kind: "anniversary";
    }[] = [];
    const y = now.getFullYear();
    const m = now.getMonth();

    (empsRaw ?? []).forEach((e: any) => {
      if (!e.date_hired) return;
      const hired = new Date(e.date_hired + "T00:00:00");
      if (hired.getMonth() !== m) return;

      const years = y - hired.getFullYear();
      if (years <= 0) return;

      const lastDay = new Date(y, m + 1, 0).getDate();
      const day = Math.min(hired.getDate(), lastDay);
      const thisYear = new Date(y, m, day);

      anniversaries.push({
        date: fmt(thisYear),
        label: `${e.first_name} ${e.last_name} · ${years} yr${
          years > 1 ? "s" : ""
        }`,
        kind: "anniversary",
      });
    });

    return NextResponse.json(
      { paydays, holidays, anniversaries, periods },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("GET /payroll/calendar-events error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
