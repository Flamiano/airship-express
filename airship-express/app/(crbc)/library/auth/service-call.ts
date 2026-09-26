import { NextRequest } from "next/server";

export function isServiceCall(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const serviceKey = process.env.NEXT_PUBLIC_CRBC_SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || !authHeader) return false;
  const expected = `Bearer ${serviceKey}`.trim();
  const actual = authHeader.trim();
  return actual === expected;
}
