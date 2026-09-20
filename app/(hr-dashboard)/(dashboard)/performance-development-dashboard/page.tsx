import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getAuthenticatedActor } from "@/performance-development-dashboard/lib/auth/actor";
import {
  cachedPerDevAccountType,
  loginRouteForAccountType,
} from "@/performance-development-dashboard/lib/auth/redirect";
import { PerformanceDashboard } from "@/performance-development-dashboard/components/dashboard/PerformanceDashboard";
import type { CurrentPerDevUser } from "@/performance-development-dashboard/types";

export const dynamic = "force-dynamic";

export default async function PerformanceDevelopmentPage() {
  const actor = await getAuthenticatedActor();

  if (actor instanceof NextResponse) {
    redirect(loginRouteForAccountType(cachedPerDevAccountType()));
  }

  const serverUser: CurrentPerDevUser = {
    fullName: actor.accountFullName,
    role: actor.role,
    email: actor.accountEmail,
  };

  return (
    <PerformanceDashboard
      serverUser={serverUser}
      actorType={actor.actorType}
    />
  );
}
