"use client";

import { useEffect, useState } from "react";
import { type AppRole, getCurrentRole, normalizeRole } from "../../lib/roleAccess";
import { supabase } from "../../lib/supabase/supabaseClient";

export type FtmProfile = {
  role: AppRole | null;
  name: string;
  email: string;
  ready: boolean;
};

/**
 * Signed-in FTM user, read the same way the old GlobalNavbar did: Supabase
 * session first, then the role/name cached in browser storage.
 */
export function useFtmProfile(): FtmProfile {
  const [profile, setProfile] = useState<FtmProfile>({ role: null, name: "Account", email: "", ready: false });

  useEffect(() => {
    let active = true;
    const hydrate = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data } = sessionData.session?.user
        ? { data: { user: sessionData.session.user } }
        : await supabase.auth.getUser();
      if (!active) return;
      const authUser = data.user;
      const role = normalizeRole(authUser?.app_metadata?.role ?? authUser?.user_metadata?.role) ?? getCurrentRole();
      const storedEmail = window.localStorage.getItem("email");
      setProfile({
        role,
        name: authUser?.user_metadata?.full_name || authUser?.email || window.localStorage.getItem("displayName") || storedEmail || "Account",
        email: authUser?.email || storedEmail || "",
        ready: true,
      });
    };
    void hydrate();
    const { data: subscription } = supabase.auth.onAuthStateChange(() => void hydrate());
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return profile;
}

/** "Maria Santos" -> "Maria", "maria.santos@x.com" -> "Maria". */
export function firstNameOf(name: string): string {
  const base = name.includes("@") ? name.split("@")[0] : name;
  const first = base.split(/[\s._-]+/).filter(Boolean)[0] || "there";
  return first.charAt(0).toUpperCase() + first.slice(1);
}

export function formatRoleLabel(role: AppRole | null | undefined): string {
  if (!role) return "User";
  return role.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
