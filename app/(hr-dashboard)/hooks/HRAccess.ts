"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "../supabase/client";
import { validateHRRole, ROLE_DASHBOARD_MAP } from "../utils/roleValidation";

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

      const { data: userRoleData, error } = await supabase
        .from("hr_admin")
        .select("id, role, full_name, email, employee_id")
        .eq("id", session.user.id)
        .single();

      if (error || !userRoleData) {
        console.error("Error fetching user role:", error);
        router.push("/hrAuth");
        return;
      }

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
        "/hrAuth"
      );
    },
  };
}
