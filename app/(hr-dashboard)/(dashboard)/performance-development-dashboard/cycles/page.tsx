import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { requireHrAdmin } from "@/performance-development-dashboard/lib/auth/hrIdentity";
import { listPerformanceCycles } from "@/performance-development-dashboard/lib/performance/cycles";
import { CycleManagement } from "@/performance-development-dashboard/components/performance-cycle/CycleManagement";
import type { CurrentPerDevUser } from "@/performance-development-dashboard/types";

export const dynamic = "force-dynamic";

export default async function PerformanceCyclesPage() {
  const auth = await requireHrAdmin();

  if (auth instanceof NextResponse) {
    redirect("/hrAuth");
  }

  const serverUser: CurrentPerDevUser = {
    fullName: auth.fullName,
    role: auth.role,
    email: auth.email,
  };

  const cycles = await listPerformanceCycles();

  if (cycles instanceof NextResponse) {
    return (
      <CycleManagement
        serverUser={serverUser}
        initialCycles={[]}
        initialError="Failed to load performance cycles. Please try again."
      />
    );
  }

  return <CycleManagement serverUser={serverUser} initialCycles={cycles} />;
}