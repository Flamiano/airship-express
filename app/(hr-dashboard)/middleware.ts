import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabaseAdmin } from "./supabase/admin-client";
import { PROTECTED_HR_ROUTES, AUTH_ROUTES } from "./constants/route";
import { validateHRRole, EMPLOYEE_ACCESS_ROUTES } from "./utils/roleValidation";

export async function middleware(req: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_HR_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_HR_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          req.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: req.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: any) {
          req.cookies.set({
            name,
            value: "",
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: req.headers,
            },
          });
          response.cookies.set({
            name,
            value: "",
            ...options,
          });
        },
      },
    }
  );

  const pathname = req.nextUrl.pathname;

  // Skip middleware for auth API routes
  if (pathname.includes("/api/auth/")) {
    return response;
  }

  // Get session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // --- Auth route handling (login pages) ---
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname === route);

  if (isAuthRoute && session) {
    try {
      // HR Admin first
      const { data: hrAdmin } = await supabaseAdmin
        .from("hr_admin")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();

      if (hrAdmin) {
        const { ROLE_DASHBOARD_MAP } = await import("./utils/roleValidation");
        const dashboard =
          ROLE_DASHBOARD_MAP[hrAdmin.role as keyof typeof ROLE_DASHBOARD_MAP];
        if (dashboard) {
          return NextResponse.redirect(new URL(dashboard, req.url));
        }
        return response;
      }

      // Employee / Manager fallback
      const { data: employee } = await supabaseAdmin
        .from("hr1_employees")
        .select("id, status")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();

      if (employee && employee.status === "active") {
        // Authenticated employee on an auth route — redirect to employee portal
        return NextResponse.redirect(
          new URL("/employee-dashboard", req.url)
        );
      }
    } catch (error) {
      console.error("Error checking role for auth route:", error);
    }
    return response;
  }

  // --- Unauthenticated: redirect to login ---
  if (!session) {
    const isProtectedRoute = PROTECTED_HR_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(route + "/")
    );

    if (isProtectedRoute) {
      const isEmployeeRoute = EMPLOYEE_ACCESS_ROUTES.some(
        (route) => pathname === route || pathname.startsWith(route + "/")
      );
      return NextResponse.redirect(
        new URL(isEmployeeRoute ? "/employeeAuth" : "/hrAuth", req.url)
      );
    }
    return response;
  }

  // --- Authenticated: protect HR routes ---
  const isProtectedRoute = PROTECTED_HR_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  if (isProtectedRoute) {
    try {
      // HR Admin first
      const { data: hrAdmin } = await supabaseAdmin
        .from("hr_admin")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();

      if (hrAdmin) {
        const validation = await validateHRRole(hrAdmin.role, pathname);
        if (!validation.isValid) {
          console.warn(
            `HR Admin with role "${hrAdmin.role}" attempted to access "${pathname}"`
          );
          return NextResponse.redirect(
            new URL(validation.redirectTo || "/hrAuth", req.url)
          );
        }
        return response;
      }

      // Employee / Manager fallback
      const { data: employee } = await supabaseAdmin
        .from("hr1_employees")
        .select("id, status")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();

      if (!employee || employee.status !== "active") {
        console.error("Middleware: session user is not a linked active employee");
        return NextResponse.redirect(new URL("/hrAuth", req.url));
      }

      // Check if this employee account type may access the requested path.
      // For now, only PerDev is in EMPLOYEE_ACCESS_ROUTES.
      const mayAccess = EMPLOYEE_ACCESS_ROUTES.some(
        (route) => pathname === route || pathname.startsWith(route + "/")
      );

      if (!mayAccess) {
        console.warn(
          `Employee account attempted to access unauthorized path: "${pathname}"`
        );
        return NextResponse.redirect(new URL("/hrAuth", req.url));
      }

      // Employee / Manager authorized for this path — allow through.
    } catch (error) {
      console.error("Error checking role in HR middleware:", error);
      return NextResponse.redirect(new URL("/hrAuth", req.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/hr-dashboard/:path*",
    "/hrAuth",
    "/employeeAuth",
    "/((?!_next/static|_next/image|favicon.ico|images/|public/|api/|employee-dashboard).*)",
  ],
};
