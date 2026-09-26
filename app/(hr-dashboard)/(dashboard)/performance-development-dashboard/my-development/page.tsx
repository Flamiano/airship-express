import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getAuthenticatedActor } from "@/performance-development-dashboard/lib/auth/actor";
import {
  cachedPerDevAccountType,
  loginRouteForAccountType,
} from "@/performance-development-dashboard/lib/auth/redirect";
import { MyDevelopment } from "@/performance-development-dashboard/components/development/MyDevelopment";
import type { CurrentPerDevUser } from "@/performance-development-dashboard/types";

export const dynamic = "force-dynamic";

/**
 * Employee/Manager "My Development" (self-service, read-only).
 *
 * Authenticated PerDev access only. No employee roster, no employee
 * selector, no organization-wide queries: identity is resolved server-side
 * inside the My Development API from the authenticated actor. Managers see
 * their OWN development here (never direct reports). Enforcement lives in
 * the endpoint; this page only establishes authentication.
 */
export default async function MyDevelopmentPage() {
  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) {
    redirect(loginRouteForAccountType(cachedPerDevAccountType()));
  }

  const serverUser: CurrentPerDevUser = {
    fullName: actor.accountFullName,
    role: actor.role,
    email: actor.accountEmail,
  };

  return <MyDevelopment serverUser={serverUser} />;
}
