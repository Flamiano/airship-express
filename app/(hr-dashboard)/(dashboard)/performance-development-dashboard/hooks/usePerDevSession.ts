"use client";

import { useEffect, useState } from "react";
import {
  cachePerDevAccountType,
  cachedPerDevAccountType,
  redirectToLogin,
} from "@/performance-development-dashboard/lib/auth/redirect";
import type {
  CurrentPerDevUser,
  PerDevSessionActor,
  PerDevSessionEmployee,
} from "@/performance-development-dashboard/types";

const SESSION_API = "/performance-development-dashboard/api/auth/session";

type SessionResponse = {
  authenticated: boolean;
  actor: PerDevSessionActor;
  employee: PerDevSessionEmployee | null;
  hasLinkedEmployee: boolean;
  user: CurrentPerDevUser & { accountType: "hr_admin" | "manager" | "employee" };
};

type PerDevSessionUser = CurrentPerDevUser & {
  initials: string;
  accountType: "hr_admin" | "manager" | "employee";
};

function initialsOf(fullName: string): string {
  return fullName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function usePerDevSession() {
  const [user, setUser] = useState<PerDevSessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const response = await fetch(SESSION_API, { credentials: "include" });
        const data: SessionResponse | null = await response
          .json()
          .catch(() => null);
        if (!mounted) return;

        if (!response.ok || !data?.authenticated || !data.user) {
          redirectToLogin(data?.user?.accountType);
          return;
        }

        cachePerDevAccountType(data.user.accountType);
        setUser({
          fullName: data.user.fullName || "HR User",
          role: data.user.role,
          email: data.user.email,
          initials: initialsOf(data.user.fullName),
          accountType: data.user.accountType,
        });
        setLoading(false);
      } catch (error) {
        if (mounted) {
          redirectToLogin(cachedPerDevAccountType());
          setLoading(false);
          console.error("usePerDevSession: session fetch failed:", error);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return { user, loading };
}