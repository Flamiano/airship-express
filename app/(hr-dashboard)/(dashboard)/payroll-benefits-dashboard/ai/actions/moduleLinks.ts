import "server-only";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";

export type ModuleLink = {
  label: string;
  full: string;
  href: string;
};

const MODULES: ModuleLink[] = [
  {
    label: "Payroll",
    full: "Payroll Management",
    href: "/payroll-benefits-dashboard/payroll",
  },
  {
    label: "Job Settings",
    full: "Job Position Rates & Settings",
    href: "/payroll-benefits-dashboard/job-settings",
  },
  {
    label: "Bank Details",
    full: "Employee Bank Accounts",
    href: "/payroll-benefits-dashboard/bank",
  },
  {
    label: "Compensation",
    full: "Compensation Planning",
    href: "/payroll-benefits-dashboard/compensation",
  },
  {
    label: "Claims",
    full: "Claims and Reimbursement",
    href: "/payroll-benefits-dashboard/claims",
  },
  {
    label: "Benefits",
    full: "Benefits & Government Contributions",
    href: "/payroll-benefits-dashboard/benefits",
  },
  {
    label: "Analytics",
    full: "HR Analytics Dashboard",
    href: "/payroll-benefits-dashboard/hr-analytics-dashboard",
  },
];

const ALLOWED_ROLES = ["super_admin", "hr_payroll_admin"];

const INTENT_PATTERNS: Array<{
  keys: RegExp[];
  href: string;
}> = [
  {
    href: "/payroll-benefits-dashboard/bank",
    keys: [
      /\b(bank|banking|bank details|bank account|account setup)\b/i,
      /\b(missing bank|complete bank|add bank)\b/i,
    ],
  },
  {
    href: "/payroll-benefits-dashboard/job-settings",
    keys: [
      /\b(job settings|salary settings|position rate|daily rate|job position)\b/i,
    ],
  },
  {
    href: "/payroll-benefits-dashboard/payroll",
    keys: [
      /\b(payroll run|payroll runs|process payroll|run payroll|payslip|payslips)\b/i,
    ],
  },
  {
    href: "/payroll-benefits-dashboard/compensation",
    keys: [/\b(compensation|merit|budget planning|labor budget)\b/i],
  },
  {
    href: "/payroll-benefits-dashboard/claims",
    keys: [/\b(claims|reimbursement|claim)\b/i],
  },
  {
    href: "/payroll-benefits-dashboard/benefits",
    keys: [
      /\b(benefits|allowances|government contributions|sss|philhealth|pag-ibig)\b/i,
    ],
  },
  {
    href: "/payroll-benefits-dashboard/hr-analytics-dashboard",
    keys: [/\b(analytics|dashboard|reports|insights)\b/i],
  },
];

function matchModuleFromMessage(message: string): ModuleLink | null {
  for (const intent of INTENT_PATTERNS) {
    for (const pattern of intent.keys) {
      if (pattern.test(message)) {
        const mod = MODULES.find((m) => m.href === intent.href);
        if (mod) return mod;
      }
    }
  }
  return null;
}

export type LinkCheckResult = {
  ok: boolean;
  reason: string | null;
  module: ModuleLink | null;
  adminName: string | null;
  adminRole: string | null;
};

export async function resolveModuleLink(
  message: string,
  adminId: string
): Promise<LinkCheckResult> {
  const { data: admin } = await supabaseAdmin
    .from("hr_admin")
    .select("id, full_name, role")
    .eq("id", adminId)
    .maybeSingle();

  if (!admin) {
    return {
      ok: false,
      reason: "no_session",
      module: null,
      adminName: null,
      adminRole: null,
    };
  }

  if (!ALLOWED_ROLES.includes(admin.role)) {
    return {
      ok: false,
      reason: "wrong_role",
      module: null,
      adminName: admin.full_name ?? null,
      adminRole: admin.role ?? null,
    };
  }

  const module = matchModuleFromMessage(message);
  if (!module) {
    return {
      ok: false,
      reason: "no_match",
      module: null,
      adminName: admin.full_name ?? null,
      adminRole: admin.role ?? null,
    };
  }

  await supabaseAdmin.from("hr4_airy_link_permissions").insert({
    admin_id: adminId,
    admin_role: admin.role,
    href: module.href,
    label: module.label,
  });

  return {
    ok: true,
    reason: null,
    module,
    adminName: admin.full_name ?? null,
    adminRole: admin.role ?? null,
  };
}
