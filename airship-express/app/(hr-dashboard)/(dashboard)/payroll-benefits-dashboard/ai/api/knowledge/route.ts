import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";

const KNOWLEDGE_DIR = path.join(
  process.cwd(),
  "app",
  "(hr-dashboard)",
  "(dashboard)",
  "payroll-benefits-dashboard",
  "ai",
  "knowledge",
  "static"
);

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");

  if (!key || !/^[a-z0-9-]+$/i.test(key)) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  const filePath = path.join(KNOWLEDGE_DIR, `${key}.md`);

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return NextResponse.json({ key, content });
  } catch {
    return NextResponse.json({ error: "Knowledge not found" }, { status: 404 });
  }
}
