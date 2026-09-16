"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { persistAuthUser, signOut } from "../lib/auth";
import { getCurrentRole, getDashboardRouteForRole, normalizeRole, type AppRole } from "../lib/roleAccess";

const INACTIVITY_TIMEOUT_MS = 4 * 60 * 1000;
const PUBLIC_PATHS = new Set(["/", "/ftmAuth"]);
const ROLE_PATHS: Record<AppRole, string[]> = {
  admin: ["/dashboard", "/alerts", "/cost", "/driver", "/fuel", "/fvm", "/vrds", "/users", "/account"],
  fleet_manager: ["/dashboard", "/alerts", "/cost", "/driver", "/fuel", "/fvm", "/vrds", "/account"],
  dispatcher: ["/dashboard", "/alerts", "/cost", "/driver/overview", "/fuel", "/vrds", "/account"],
  driver: ["/dashboard", "/driver", "/fuel", "/alerts", "/account"],
  customer: ["/customer", "/account"],
};

function pathIsAllowed(pathname: string, role: AppRole) {
  return ROLE_PATHS[role].some((allowedPath) => pathname === allowedPath || pathname.startsWith(`${allowedPath}/`));
}

export default function FtmSecurityProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const lastActivity = useRef(Date.now());
  const signingOut = useRef(false);

  useEffect(() => {
    if (PUBLIC_PATHS.has(pathname)) return;

    let active = true;
    const enforceSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active || signingOut.current) return;
      const user = data.session?.user;
      if (!user) {
        router.replace(`/ftmAuth?next=${encodeURIComponent(pathname)}`);
        return;
      }

      const role = normalizeRole(user.app_metadata?.role ?? user.user_metadata?.role ?? user.role) ?? getCurrentRole();
      if (!role || !pathIsAllowed(pathname, role)) {
        router.replace(getDashboardRouteForRole(role));
      }
    };

    void enforceSession();
    const onAuthStateChange = () => void enforceSession();
    const { data: authSubscription } = supabase.auth.onAuthStateChange(onAuthStateChange);
    return () => {
      active = false;
      authSubscription.subscription.unsubscribe();
    };
  }, [pathname, router]);

  useEffect(() => {
    if (PUBLIC_PATHS.has(pathname)) return;

    const markActivity = () => { lastActivity.current = Date.now(); };
    const activityEvents = ["pointerdown", "keydown", "mousemove", "scroll", "touchstart"];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, markActivity, { passive: true }));

    const timer = window.setInterval(() => {
      if (Date.now() - lastActivity.current < INACTIVITY_TIMEOUT_MS || signingOut.current) return;
      signingOut.current = true;
      void signOut().finally(() => router.replace("/ftmAuth?reason=timeout"));
    }, 15_000);

    return () => {
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, markActivity));
      window.clearInterval(timer);
    };
  }, [pathname, router]);

  return <>{children}</>;
}
