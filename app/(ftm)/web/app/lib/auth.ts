import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import { getDashboardRouteForRole, normalizeRole, type AppRole } from "./roleAccess";

export type AuthUser = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  role?: AppRole | null;
};

export function mapSupabaseUser(user: User | null): AuthUser | null {
  if (!user) return null;

  const role = normalizeRole(
    user.app_metadata?.role
      ?? user.user_metadata?.role
      ?? (user as User & { role?: string | null }).role
      ?? null
  );
  return {
    id: user.id,
    email: user.email,
    full_name: user.user_metadata?.full_name ?? null,
    role,
  };
}

export function persistAuthUser(user: AuthUser | null) {
  if (typeof window === "undefined") return;

  if (!user) {
    window.localStorage.removeItem("role");
    window.localStorage.removeItem("appRole");
    window.localStorage.removeItem("userRole");
    window.localStorage.removeItem("email");
    window.localStorage.removeItem("displayName");
    return;
  }

  const role = user.role;
  if (!role) {
    persistAuthUser(null);
    return;
  }
  window.localStorage.setItem("role", role);
  window.localStorage.setItem("appRole", role);
  window.localStorage.setItem("userRole", role);
  window.localStorage.setItem("email", user.email ?? "");
  window.localStorage.setItem("displayName", user.full_name ?? user.email ?? "");
}

export async function signInWithPassword(email: string, password: string) {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001";
  const response = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) return { user: null, error: new Error(body.error || "Unable to sign in") };

  const session = body.session;
  if (!session?.access_token || !session.refresh_token) {
    return { user: null, error: new Error("Authentication did not return a valid session") };
  }
  const { error: sessionError } = await supabase.auth.setSession(session);
  if (sessionError) return { user: null, error: sessionError };
  const user = mapSupabaseUser(body.user ? {
    ...body.user,
    app_metadata: body.user.app_metadata || {},
    user_metadata: body.user.user_metadata || {},
    role: body.user.role,
  } as User & { role?: string | null } : null);
  if (!user) return { user: null, error: new Error("Authentication did not return a user") };

  persistAuthUser(user);
  return { user, error: null };
}

export async function signUpWithPassword(
  email: string,
  password: string,
  full_name: string,
  role: AppRole
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name,
        role,
      },
    },
  });

  return { user: mapSupabaseUser(data.user ?? null), error };
}

export async function signOut() {
  await supabase.auth.signOut();
  persistAuthUser(null);
}

export async function requestSensitiveOtp() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) throw new Error("Your account has no verified email address");

  const { error } = await supabase.auth.signInWithOtp({
    email: user.email,
    options: { shouldCreateUser: false },
  });
  if (error) throw error;
  return { message: "A Supabase verification code was sent. It expires in 60 seconds." };
}

export async function verifySensitiveOtp(code: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) throw new Error("Your account has no verified email address");

  const { data, error } = await supabase.auth.verifyOtp({
    email: user.email,
    token: code,
    type: "email",
  });
  if (error) throw error;
  return { verified: Boolean(data.user) };
}

export function getDashboardRouteForAuthUser(user: AuthUser | null) {
  return getDashboardRouteForRole(user?.role);
}
