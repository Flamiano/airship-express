import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/app/(hr-dashboard)/supabase/server";
import { resolveHrAccountForSession } from "@/app/(hr-dashboard)/lib/hr-account";
import { EmployeePortal } from "@/app/(employee-portal)/employee-dashboard/components/EmployeePortal";

export const dynamic = "force-dynamic";

export default async function EmployeeDashboardPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    redirect("/employeeAuth");
  }

  const account = await resolveHrAccountForSession(session.user.id);

  if (!account) {
    redirect("/employeeAuth");
  }

  // HR Admin accounts should use the HR admin portal, not the employee portal.
  if (account.accountType === "hr_admin") {
    redirect("/payroll-benefits-dashboard");
  }

  return (
    <EmployeePortal
      fullName={account.fullName}
      email={account.email}
      accountType={account.accountType}
      employeeIdNumber={account.employeeIdNumber}
    />
  );
}
