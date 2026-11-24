import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "Auth route ready for Supabase Auth integration" });
}