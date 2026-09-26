import "server-only";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { sendSecurityAlertEmail } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/mailer";

export type SecurityVerdict = {
  suspicious: boolean;
  intent: string | null;
  severity: "warning" | "critical" | null;
  attemptNumber: number;
  shouldLogout: boolean;
  warningMessage: string | null;
  redirectTo: string | null;
};

type SuspiciousRule = {
  intent: string;
  patterns: RegExp[];
  severity: "warning" | "critical";
};

const SUSPICIOUS_PATTERNS: SuspiciousRule[] = [
  {
    intent: "expose_salary_amounts",
    severity: "critical",
    patterns: [
      /\b(salary|sahod|sweldo|basic pay|compensation|net pay|gross pay|rate|daily rate|monthly pay)\b[\s\S]{0,40}\b(of|ni|for|kay|ng)\b/i,
      /\b(show|reveal|expose|tell|give|list|send|fetch|get|find|retrieve|check|lookup|pakita|ipakita|ibigay|sabihin|ilista|hanapin|tingnan|kunin)\b[\s\S]{0,40}\b(salary|sahod|sweldo|basic pay|compensation|net pay|gross pay|rate|daily rate|monthly pay)\b/i,
      /\bhow much\b[\s\S]{0,20}\b(earn|earns|earning|salary|sahod|sweldo|kinikita|kumikita|sinasahod)\b/i,
      /\b(magkano|gano|gaano)\b[\s\S]{0,20}\b(sahod|sweldo|kinikita|sinasahod|kita)\b/i,
      /\b(salary|sahod|sweldo|rate)\b[\s\S]{0,20}\b(of|ni|for|kay)\b/i,
    ],
  },
  {
    intent: "reduce_salary",
    severity: "critical",
    patterns: [
      /\b(reduce|deduct|lower|cut|bawasan|ibawas|babaan|baba|babaon)\b[\s\S]{0,40}\b(salary|sahod|sweldo|pay|rate)\b/i,
      /\b(salary|sahod|sweldo)\b[\s\S]{0,30}\b(reduce|deduct|lower|cut|bawasan|ibawas)\b/i,
      /\bchange\b[\s\S]{0,30}\b(salary|sahod|sweldo)\b[\s\S]{0,30}\b(without|secretly|walang)\b/i,
    ],
  },
  {
    intent: "expose_bank_numbers",
    severity: "critical",
    patterns: [
      /\b(show|reveal|expose|list|fetch|get|find|retrieve|check|ipakita|ibigay|ilista|hanapin|kunin)\b[\s\S]{0,40}\b(bank account|account number|bank number|account no|bank details|bank account number)\b/i,
      /\b(bank account|account number)\b[\s\S]{0,30}\b(of|ni|for|kay)\b/i,
      /\ball\b[\s\S]{0,30}\b(bank|account)\b[\s\S]{0,30}\b(number|details|numbers)\b/i,
    ],
  },
  {
    intent: "expose_birthdates",
    severity: "critical",
    patterns: [
      /\b(show|reveal|expose|list|fetch|get|find|retrieve|check|ipakita|ibigay|ilista|hanapin|kunin)\b[\s\S]{0,40}\b(birthdate|birthday|date of birth|kapanganakan|kaarawan)\b/i,
      /\b(birthdate|birthday|date of birth)\b[\s\S]{0,30}\b(of|ni|for|kay|all|everyone)\b/i,
    ],
  },
  {
    intent: "expose_specific_payslip_amount",
    severity: "critical",
    patterns: [
      /\b(payslip|pay slip)\b[\s\S]{0,40}\b(net pay|gross pay|amount|salary|sahod|sweldo|total|breakdown|details|values|halaga)\b/i,
      /\b(show|give|tell|reveal|fetch|get|ibigay|ipakita|sabihin|kunin)\b[\s\S]{0,40}\b(net pay|gross pay|salary|sahod|sweldo)\b[\s\S]{0,40}\b(of|ni|for|kay)\b/i,
      /\b(net pay|gross pay|salary|sahod)\b[\s\S]{0,20}\b(of|ni|for|kay)\b/i,
    ],
  },
  {
    intent: "mass_export",
    severity: "warning",
    patterns: [
      /\b(export|download|send me|email me|i-send|i-download)\b[\s\S]{0,40}\b(all|every|lahat|bawat)\b[\s\S]{0,40}\b(payroll|salary|sahod|payslip|employee)\b/i,
    ],
  },
];

const MAX_ATTEMPTS = 3;

export async function checkSuspiciousRequest(
  message: string,
  adminId: string,
  adminName: string,
  adminEmail: string
): Promise<SecurityVerdict> {
  let intent: string | null = null;
  let severity: "warning" | "critical" | null = null;

  for (const rule of SUSPICIOUS_PATTERNS) {
    for (const pattern of rule.patterns) {
      if (pattern.test(message)) {
        intent = rule.intent;
        severity = rule.severity;
        break;
      }
    }
    if (intent) break;
  }

  if (!intent || !severity) {
    return {
      suspicious: false,
      intent: null,
      severity: null,
      attemptNumber: 0,
      shouldLogout: false,
      warningMessage: null,
      redirectTo: null,
    };
  }

  await supabaseAdmin.from("hr4_airy_security_events").insert({
    admin_id: adminId,
    admin_name: adminName,
    admin_email: adminEmail,
    event_type: "suspicious_request",
    trigger_message: message.slice(0, 500),
    trigger_intent: intent,
    severity,
  });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from("hr4_airy_security_events")
    .select("*", { count: "exact", head: true })
    .eq("admin_id", adminId)
    .eq("event_type", "suspicious_request")
    .gte("created_at", since);

  const attemptNumber = count ?? 1;
  const shouldLogout = attemptNumber >= MAX_ATTEMPTS;

  const warningByIntent: Record<string, string> = {
    expose_salary_amounts:
      "I cannot expose salary amounts. Salary figures are only visible inside the payslip image you generate for a specific employee. That request has been logged.",
    reduce_salary:
      "I cannot modify salaries through chat. Salary changes require a formal adjustment request with a written reason. That request has been logged.",
    expose_bank_numbers:
      "Bank account numbers are confidential. I cannot display them. That request has been logged.",
    expose_birthdates:
      "Birthdates are personal data protected by the Data Privacy Act. I cannot display them. That request has been logged.",
    expose_specific_payslip_amount:
      "I can generate the payslip as an image for the admin, but I cannot read out amounts in chat. That request has been logged.",
    mass_export:
      "Bulk exports of salary or employee data need written approval from the Data Privacy Officer. That request has been noted.",
  };

  let warningMessage =
    warningByIntent[intent] ||
    "That request touches restricted information and has been logged.";

  if (shouldLogout) {
    warningMessage =
      "This is your third restricted request in 24 hours. Your session will end now for security reasons.";
  } else {
    const remaining = MAX_ATTEMPTS - attemptNumber;
    warningMessage += ` Attempt ${attemptNumber} of ${MAX_ATTEMPTS}. ${remaining} more will end your session.`;
  }

  void notifyPayrollAdmins({
    offenderId: adminId,
    offenderName: adminName,
    offenderEmail: adminEmail,
    intent,
    severity,
    attemptNumber,
    messageText: message,
  });

  return {
    suspicious: true,
    intent,
    severity,
    attemptNumber,
    shouldLogout,
    warningMessage,
    redirectTo: shouldLogout ? "/hrAuth" : null,
  };
}

async function notifyPayrollAdmins({
  offenderId,
  offenderName,
  offenderEmail,
  intent,
  severity,
  attemptNumber,
  messageText,
}: {
  offenderId: string;
  offenderName: string;
  offenderEmail: string;
  intent: string;
  severity: string;
  attemptNumber: number;
  messageText: string;
}) {
  try {
    const { data: admins } = await supabaseAdmin
      .from("hr_admin")
      .select("id, email, full_name, role, receives_security_alerts")
      .in("role", ["super_admin", "hr_payroll_admin"])
      .neq("id", offenderId)
      .eq("receives_security_alerts", true);

    if (!admins || admins.length === 0) return;

    const { data: offender } = await supabaseAdmin
      .from("hr_admin")
      .select("role")
      .eq("id", offenderId)
      .maybeSingle();

    const offenderRole = offender?.role ?? "unknown";

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: events } = await supabaseAdmin
      .from("hr4_airy_security_events")
      .select("created_at, trigger_message, trigger_intent, severity")
      .eq("admin_id", offenderId)
      .eq("event_type", "suspicious_request")
      .gte("created_at", since)
      .order("created_at", { ascending: true });

    const attemptsTimeline = (events || []).map((e: any) => ({
      at: e.created_at,
      message: e.trigger_message ?? "",
      intent: e.trigger_intent ?? "unknown",
      severity: e.severity ?? "warning",
    }));

    const totalAttemptsToday = attemptsTimeline.length;

    await Promise.all(
      admins.map((a: any) =>
        sendSecurityAlertEmail({
          to: a.email,
          recipientName: a.full_name || "Admin",
          offenderName,
          offenderEmail,
          offenderRole,
          intent,
          severity,
          attemptNumber,
          totalAttemptsToday,
          messageText,
          attemptsTimeline,
        }).catch((err: any) =>
          console.error("[security-alert] email failed for", a.email, err)
        )
      )
    );
  } catch (err) {
    console.error("[security-alert] dispatch failed:", err);
  }
}
