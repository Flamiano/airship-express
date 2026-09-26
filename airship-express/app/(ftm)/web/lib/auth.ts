import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import { getDashboardRouteForRole, normalizeRole, type AppRole } from "./roleAccess";

const DEMO_CREDENTIALS: Record<string, { password: string; role: AppRole }> = {
  "dummy@airship.local": { password: "dummy", role: "admin" },
  "dispatcher@airship.local": { password: "dummy", role: "dispatcher" },
  "fleet@airship.local": { password: "dummy", role: "fleet_manager" },
};

export type AuthUser = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  role?: AppRole | null;
};

export function mapSupabaseUser(user: User | null): AuthUser | null {
  if (!user) return null;

  const role = normalizeRole(user.user_metadata?.role ?? user.role ?? null);
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

  const role = user.role ?? "customer";
  window.localStorage.setItem("role", role);
  window.localStorage.setItem("appRole", role);
  window.localStorage.setItem("userRole", role);
  window.localStorage.setItem("email", user.email ?? "");
  window.localStorage.setItem("displayName", user.full_name ?? user.email ?? "");
}

export async function signInWithPassword(email: string, password: string) {
  const demoCredential = DEMO_CREDENTIALS[email.trim().toLowerCase()];

  if (demoCredential && password === demoCredential.password) {
    const user = {
      id: `demo-${demoCredential.role}`,
      email: email.trim(),
      full_name: "Demo User",
      role: demoCredential.role,
    };

    persistAuthUser(user);
    return { user, error: null };
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  const user = mapSupabaseUser(data.user ?? null);

  if (error) {
    return { user: null, error };
  }

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

export function getDashboardRouteForAuthUser(user: AuthUser | null) {
  return getDashboardRouteForRole(user?.role ?? "customer");
}
