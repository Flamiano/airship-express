import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PROTECTED_HR_ROUTES, AUTH_ROUTES } from "../constants/routes";
import { validateHRRole } from "../utils/roleValidation";

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

  // Check if trying to access auth routes (login page)
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname === route);

  // If on auth route and has session, redirect to appropriate dashboard
  if (isAuthRoute && session) {
    try {
      const { data: userRole } = await supabase
        .from("hr_admin")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (userRole) {
        const { ROLE_DASHBOARD_MAP } = await import("./utils/roleValidation");
        const dashboard =
          ROLE_DASHBOARD_MAP[userRole.role as keyof typeof ROLE_DASHBOARD_MAP];
        if (dashboard) {
          const redirectUrl = new URL(dashboard, req.url);
          return NextResponse.redirect(redirectUrl);
        }
      }
    } catch (error) {
      console.error("Error checking role for auth route:", error);
    }
    return response;
  }

  // If no session and trying to access protected route
  if (!session) {
    const isProtectedRoute = PROTECTED_HR_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(route + "/")
    );

    if (isProtectedRoute) {
      const redirectUrl = new URL("/hrAuth", req.url);
      return NextResponse.redirect(redirectUrl);
    }
    return response;
  }

  // Check if trying to access a protected HR route
  const isProtectedRoute = PROTECTED_HR_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  if (isProtectedRoute) {
    try {
      // Get user role
      const { data: userRole, error } = await supabase
        .from("hr_admin")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (error || !userRole) {
        console.error("Error fetching user role:", error);
        const redirectUrl = new URL("/hrAuth", req.url);
        return NextResponse.redirect(redirectUrl);
      }

      // Validate role for this path
      const validation = await validateHRRole(userRole.role, pathname);

      if (!validation.isValid) {
        console.warn(
          `User with role "${userRole.role}" attempted to access "${pathname}"`
        );

        const redirectUrl = new URL(
          validation.redirectTo || "/hrAuth",
          req.url
        );
        return NextResponse.redirect(redirectUrl);
      }
    } catch (error) {
      console.error("Error checking role in HR middleware:", error);
      const redirectUrl = new URL("/hrAuth", req.url);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/hr-dashboard/:path*",
    "/hrAuth",
    "/((?!_next/static|_next/image|favicon.ico|images/|public/|api/).*)",
  ],
};
