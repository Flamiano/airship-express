import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("sops")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch SOPs error:", error);
      return NextResponse.json({ message: "Could not load SOPs.", error: error.message }, { status: 500 });
    }

    return NextResponse.json({ sops: data });
  } catch (err) {
    console.error("SOPs API error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "Internal server error.", error: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, sop_code, category, scope, version, effective_date, review_date, content, owner, status } = body;

    if (!title || !sop_code) {
      return NextResponse.json({ message: "Title and SOP code are required." }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("sops")
      .insert({
        title,
        sop_code,
        category: category || "general",
        scope: scope || null,
        version: version || "1.0",
        effective_date: effective_date || null,
        review_date: review_date || null,
        content: content || null,
        owner: owner || null,
        status: status || "draft",
      })
      .select()
      .single();

    if (error) {
      console.error("Create SOP error:", error);
      return NextResponse.json({ message: "Could not save SOP.", error: error.message }, { status: 500 });
    }

    return NextResponse.json({ sop: data });
  } catch (err) {
    console.error("SOPs POST error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "Internal server error.", error: errorMessage }, { status: 500 });
  }
}