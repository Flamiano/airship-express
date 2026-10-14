// app/(spnc)/spnc/lib/currentUser.ts  (next to session.ts, supabase.ts, rbac.ts)
// Reads the logged-in user's id from the session cookie.
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "./session";

export async function getSessionUserId(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifySessionToken(token);
  return payload?.userId ?? null;
}