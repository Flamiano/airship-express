import "server-only";
import { NextResponse } from "next/server";
import { createFtmAuthClient, createFtmServiceClient } from "./ftmSupabase";

const FLEET_ROLES = new Set(["admin", "fleet_manager", "dispatcher", "driver"]);
const ROLE_ALIASES: Record<string, string> = {
  admin: "admin",
  administrator: "admin",
  super_admin: "admin",
  "super-admin": "admin",
  fleet_manager: "fleet_manager",
  "fleet manager": "fleet_manager",
  "fleet-manager": "fleet_manager",
  manager: "fleet_manager",
  dispatcher: "dispatcher",
  dispatch: "dispatcher",
  "dispatch officer": "dispatcher",
  operations: "dispatcher",
  driver: "driver",
};

function normalizeRole(value: unknown) {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase().replace(/[^a-z_\-\s]/g, "");
  return ROLE_ALIASES[normalized] || ROLE_ALIASES[normalized.replace(/\s+/g, "_")] || null;
}

function readCookie(request: Request, name: string) {
  const cookie = request.headers.get("cookie") || "";
  const entry = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : null;
}

type FtmRequestContext = {
  serviceClient: NonNullable<ReturnType<typeof createFtmServiceClient>>;
  user: {
    id: string;
    email?: string;
    role: string;
    user_metadata: Record<string, unknown>;
    created_at: string;
    last_sign_in_at?: string;
    email_confirmed_at?: string;
  };
  profile: Record<string, unknown> | null;
};

// Absence of context is the discriminator used by existing API handlers.
// An explicit union avoids an inferred optional `context` on error responses.
export async function authenticateFtmRequest(request: Request): Promise<
  { context: FtmRequestContext } | { response: NextResponse }
> {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : readCookie(request, "ftm_access_token");

  if (!token) {
    return { response: NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 }) };
  }

  const serviceClient = createFtmServiceClient();
  if (!serviceClient) {
    return { response: NextResponse.json({ error: "Supabase service role is not configured" }, { status: 503 }) };
  }

  try {
    const authClient = createFtmAuthClient();
    const { data, error } = await authClient.auth.getUser(token);
    if (error || !data.user) {
      return { response: NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 }) };
    }

    const user = data.user;
    const { data: profile } = await serviceClient
      .from("users")
      .select("role, full_name, email, avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    const role = [profile?.role, user.app_metadata?.role, user.user_metadata?.role]
      .map(normalizeRole)
      .find((candidate) => candidate && FLEET_ROLES.has(candidate)) || null;

    if (!role) {
      return { response: NextResponse.json({ error: "Fleet operations are only available to fleet staff accounts." }, { status: 403 }) };
    }

    return {
      context: {
        serviceClient,
        user: {
          id: user.id,
          email: user.email,
          role,
          user_metadata: user.user_metadata || {},
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at,
          email_confirmed_at: user.email_confirmed_at,
        },
        profile,
      },
    };
  } catch (error) {
    console.error("FTM request authentication failed:", error);
    return { response: NextResponse.json({ error: "Authentication check failed" }, { status: 500 }) };
  }
}
