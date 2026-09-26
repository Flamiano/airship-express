import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";

export interface FoundEmployee {
  id: string;
  displayName: string;
  raw: Record<string, any>;
}

export async function findEmployeeByName(
  query: string
): Promise<FoundEmployee | null> {
  const needle = query.trim().toLowerCase();
  if (!needle) return null;

  const { data: employees, error } = await supabaseAdmin
    .from("hr1_employees")
    .select("*")
    .eq("status", "active")
    .limit(500);

  if (error || !employees || employees.length === 0) return null;

  const tokens = needle.split(/\s+/).filter(Boolean);
  let best: { row: any; score: number } | null = null;

  for (const row of employees) {
    const haystack = Object.values(row)
      .filter((v) => typeof v === "string")
      .join(" ")
      .toLowerCase();

    let score = 0;
    for (const token of tokens) {
      if (haystack.includes(token)) score += token.length;
    }

    if (score > 0 && (!best || score > best.score)) {
      best = { row, score };
    }
  }

  if (!best) return null;

  const row = best.row;
  const displayName =
    row.full_name ||
    [row.first_name, row.middle_name, row.last_name]
      .filter(Boolean)
      .join(" ") ||
    row.name ||
    query;

  return { id: row.id, displayName, raw: row };
}
