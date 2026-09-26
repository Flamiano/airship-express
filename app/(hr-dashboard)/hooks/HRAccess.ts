"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "../supabase/client";
import {
  validateHRRole,
  ROLE_DASHBOARD_MAP,
  EMPLOYEE_ACCESS_ROUTES,
} from "../utils/roleValidation";
import { SESSION_START_KEY, SESSION_ABSOLUTE_MS } from "../constants/session";

export function useHRAccess() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    checkAccess();
  }, [pathname]);

  const checkAccess = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/hrAuth");
        return;
      }

      // --- Absolute session expiry check (from your commit) ---
      const start = Number(localStorage.getItem(SESSION_START_KEY));
      if (start && !Number.isNaN(start)) {
        const elapsed = Date.now() - start;
        if (elapsed >= SESSION_ABSOLUTE_MS) {
          await supabase.auth.signOut();
          localStorage.removeItem(SESSION_START_KEY);
          router.push("/hrAuth");
          router.refresh();
          return;
        }
      } else {
        localStorage.setItem(SESSION_START_KEY, Date.now().toString());
      }

      // --- HR Admin lookup ---
      const { data: userRoleData } = await supabase
        .from("hr_admin")
        .select("id, role, full_name, email, employee_id")
        .eq("id", session.user.id)
        .maybeSingle();

      if (userRoleData) {
        setUserRole(userRoleData.role);
        setUserData(userRoleData);

        const validation = await validateHRRole(userRoleData.role, pathname);

        if (!validation.isValid) {
          console.warn(
            `User with role "${userRoleData.role}" tried to access "${pathname}"`
          );
          router.push(validation.redirectTo || "/hrAuth");
          return;
        }

        setIsAuthorized(true);
        return;
      }

      // --- Employee / Manager fallback ---
      const { data: employee } = await supabase
        .from("hr1_employees")
        .select("id, employee_id_number, first_name, last_name, email, status")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();

      if (!employee || employee.status !== "active") {
        console.error(
          "useHRAccess: no linked active employee found for session"
        );
        router.push("/hrAuth");
        return;
      }

      const mayAccess = EMPLOYEE_ACCESS_ROUTES.some(
        (route) => pathname === route || pathname.startsWith(route + "/")
      );

      if (!mayAccess) {
        console.warn(
          `Employee account attempted to access unauthorized path: "${pathname}"`
        );
        router.push("/employee-dashboard");
        return;
      }

      const fullName =
        [employee.first_name, employee.last_name]
          .filter(Boolean)
          .join(" ")
          .trim() ||
        employee.email ||
        "Employee";

      setUserRole("employee");
      setUserData({
        id: employee.id,
        role: "employee",
        full_name: fullName,
        email: employee.email,
        employee_id: employee.employee_id_number,
      });
      setIsAuthorized(true);
    } catch (error) {
      console.error("Error checking HR access:", error);
      router.push("/hrAuth");
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    isAuthorized,
    userRole,
    userData,
    getDashboardUrl: (role?: string) => {
      const roleToUse = role || userRole;
      if (!roleToUse) return "/hrAuth";
      return (
        ROLE_DASHBOARD_MAP[roleToUse as keyof typeof ROLE_DASHBOARD_MAP] ||
        "/employee-dashboard"
      );
    },
  };
}
