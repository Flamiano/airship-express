import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("sops")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ message: "SOP not found." }, { status: 404 });
    }

    console.error("Fetch SOP error:", error);
    return NextResponse.json({ message: "Could not load SOP." }, { status: 500 });
  }

  return NextResponse.json({ sop: data });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { title, sop_code, category, scope, version, effective_date, review_date, content, owner, status } = body;

  if (!title || !sop_code) {
    return NextResponse.json({ message: "Title and SOP code are required." }, { status: 400 });
  }

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("sops")
    .update({
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
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Update SOP error:", error);
    return NextResponse.json({ message: "Could not update SOP." }, { status: 500 });
  }

  return NextResponse.json({ sop: data });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseClient();

  const { error } = await supabase.from("sops").delete().eq("id", id);

  if (error) {
    console.error("Delete SOP error:", error);
    return NextResponse.json({ message: "Could not delete SOP." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}