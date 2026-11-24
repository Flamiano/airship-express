import { NextResponse } from "next/server";
import { createFtmAuthClient, createFtmServiceClient } from "../lib/server/ftmSupabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createFtmServiceClient() || createFtmAuthClient();
    const { data, error } = await supabase.from("vehicles").select("id").limit(1);
    if (error) return NextResponse.json({ ok: false, error: error.message });
    return NextResponse.json({ ok: true, service: "ftm-backend", sample: Array.isArray(data) ? data.length : 0 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}