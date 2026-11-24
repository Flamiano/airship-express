import { NextResponse } from "next/server";
import { isConfigured } from "../../../lib/server/backend/services/aiProvider.js";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ message: "Fleet AI route ready", aiConfigured: isConfigured() });
}