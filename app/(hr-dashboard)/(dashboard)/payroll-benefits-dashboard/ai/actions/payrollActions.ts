"use server";

import { chat } from "../providers";
import { generatePayslipImageForEmployee } from "./generatePayslipImage";
import {
  getAdminContextByUserId,
  type AdminContext,
} from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/getAdminContext";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { checkSuspiciousRequest } from "./securityGuard";
import { resolveModuleLink } from "./moduleLinks";
import {
  fetchActiveEmployeeNames,
  fetchEmployeeCounts,
  fetchEmployeesWithoutBank,
  fetchEmployeesWithoutBirthdate,
  fetchOpenRuns,
  fetchPendingApprovals,
  fetchRejectedRuns,
  fetchTopRatedEmployees,
  findEmployeeByNameSafe,
} from "../context/fetchers";
import type {
  MessageAttachment,
  AiryBlock,
  AiryStructuredReply,
} from "../shared/types";

const BASE_SYSTEM = `You are Airy, the Airship Express payroll assistant. You help the payroll admin run payroll correctly.

Write like a professional payroll officer writing a short internal note. Plain sentences. No decoration.

Hard rules:
1. No Markdown. No asterisks, bold, italics, bullets, numbered lists, headers, backticks, or tables.
2. No emojis.
3. No em-dashes. Use periods or commas.
4. Never start with Certainly, Sure, Of course, Absolutely, Great question, I'd be happy to, Let me help, Here's what I found, or As an AI.
5. Never end with Let me know if you need anything else, Feel free to ask, or I hope this helps.
6. Never say you are an AI, language model, assistant, or chatbot.
7. Keep replies short. Two to four sentences for simple questions.
8. Address the admin by first name only when natural, at most once per reply.
9. NEVER repeat the same sentence twice in one reply.
10. Never invent data. If the answer is not in the context provided, say so in one sentence.

Data protection rules (absolute):
- Never reveal any employee's salary amount, basic pay, net pay, gross pay, or any peso figure tied to a person.
- Never reveal any employee's bank account number or bank account details.
- Never reveal any employee's birthdate.
- Never list or summarize payslip amounts for any employee.
- You may name employees, list employee IDs, departments, job titles, hire dates, and statuses.
- You may list which employees are missing bank details or birthdates without exposing the value.
- You may generate payslip images when requested. The system handles that separately.

Payroll formulas:
- daily_rate = custom_daily_rate if set, else hr4_job_position_settings.daily_rate
- hourly_rate = daily_rate / hours_per_day
- basic_pay = regular_hours * hourly_rate + overtime_hours * hourly_rate * overtime_rate
- night_diff_pay = night_diff_hours * hourly_rate * (night_diff_rate - 1)
- holiday_pay = regular_holiday_hours * hourly_rate * (multiplier - 1) + special * hourly_rate * 0.3
- allowances, bonus, incentive are prorated from hr4_compen_employee_benefits and hr4_employee_incentives
- gross_pay = basic_pay + night_diff + holiday + allowances + bonus + incentive
- SSS, PhilHealth, Pag-IBIG prorated by days_worked / 30 / periods_per_month
- net_pay = gross_pay - total_deductions

Currency is Philippine peso. Format like P12,345.67 only for company-level totals or budget figures, never for an individual.`;

function buildSystem(admin: AdminContext | null): string {
  if (!admin) {
    return BASE_SYSTEM + "\n\nYou do not know who the current admin is.";
  }
  return `${BASE_SYSTEM}

Current admin:
Name ${admin.name}
First name ${admin.name.split(" ")[0]}
Email ${admin.email}
Role ${admin.role}

Address them as ${
    admin.name.split(" ")[0]
  } when natural. Never ask who they are.`;
}

async function ask(
  prompt: string,
  context: any,
  admin: AdminContext | null,
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
  maxTokens = 500
): Promise<string> {
  try {
    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [{ role: "system", content: buildSystem(admin) + "\n\n" + prompt }];

    for (const h of history.slice(-6)) {
      messages.push({ role: h.role, content: h.content });
    }

    messages.push({ role: "user", content: JSON.stringify(context, null, 2) });

    const res = await chat({ messages, temperature: 0.4, maxTokens }, "groq");
    const text = (res.content || "").trim();
    return text || "No response.";
  } catch (err: any) {
    return `Airy is unavailable: ${err?.message || "unknown error"}.`;
  }
}

function sanitizeReply(text: string): string {
  let s = text || "";
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/\*([^*]+)\*/g, "$1");
  s = s.replace(/^\s*[-*+]\s+/gm, "");
  s = s.replace(/^\s*\d+\.\s+/gm, "");
  s = s.replace(/^\s*#+\s+/gm, "");
  s = s.replace(/—/g, ",").replace(/–/g, ",");
  s = s.replace(
    /^(Certainly|Sure|Of course|Absolutely|Great question|I'd be happy to|Let me help you with that|Here's what I found)[!,.]?\s+/i,
    ""
  );
  s = s.replace(
    /\s*(Let me know if you need anything else\.?|Feel free to ask\.?|I hope this helps\.?)\s*$/i,
    ""
  );
  const lines = s
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const line of lines) {
    const key = line.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(line);
    }
  }
  return deduped.join("\n\n").trim();
}

type PendingIntent = {
  intent_type: "payslip_employee" | "payslip_run";
  employee_id?: string | null;
  employee_name?: string | null;
};

async function getPendingIntent(
  adminId: string
): Promise<PendingIntent | null> {
  const { data } = await supabaseAdmin
    .from("hr4_airy_pending_intents")
    .select("*")
    .eq("admin_id", adminId)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    intent_type: data.intent_type as any,
    employee_id: data.employee_id,
    employee_name: data.employee_name,
  };
}

async function setPendingIntent(adminId: string, intent: PendingIntent) {
  await supabaseAdmin
    .from("hr4_airy_pending_intents")
    .delete()
    .eq("admin_id", adminId);
  await supabaseAdmin.from("hr4_airy_pending_intents").insert({
    admin_id: adminId,
    intent_type: intent.intent_type,
    employee_id: intent.employee_id || null,
    employee_name: intent.employee_name || null,
  });
}

async function clearPendingIntent(adminId: string) {
  await supabaseAdmin
    .from("hr4_airy_pending_intents")
    .delete()
    .eq("admin_id", adminId);
}

async function getEmployeeRuns(employeeId: string) {
  const { data } = await supabaseAdmin
    .from("hr4_payroll_runs")
    .select("id, period_start, period_end, status, approval_status")
    .in("status", ["completed", "approved"])
    .order("period_end", { ascending: false })
    .limit(12);

  if (!data) return [];

  const { data: slips } = await supabaseAdmin
    .from("hr4_payslips")
    .select("payroll_run_id")
    .eq("employee_id", employeeId);

  const slipRunIds = new Set((slips || []).map((s) => s.payroll_run_id));
  return data.filter((r) => slipRunIds.has(r.id));
}

function detectPayslipIntent(
  message: string
): { kind: "request" | "example"; name: string | null } | null {
  const lower = message.toLowerCase();
  const wantsPayslip = /\b(payslip|pay\s*slip|payslips|pay\s*slips)\b/.test(
    lower
  );
  if (!wantsPayslip) return null;

  const wantsVisual =
    /\b(generate|create|make|render|produce|show|give|see|send|print|draw|example|sample|demo|template|image|picture|png|preview|bigyan|ipakita|larawan)\b/.test(
      lower
    );

  if (!wantsVisual) return null;

  const nameMatch =
    message.match(
      /(?:for|of|ni|kay|para\s+kay|to)\s+([A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.'-]+){0,3})/
    ) || message.match(/(?:payslip|pay\s*slip)\s+(?:of|for|ni|kay)\s+(.+)/i);

  if (nameMatch && nameMatch[1]) {
    const candidate = nameMatch[1].trim().replace(/[.?!,]+$/, "");
    if (/^(example|sample|demo|me|a|an|the)\b/i.test(candidate)) {
      return { kind: "example", name: null };
    }
    return { kind: "request", name: candidate };
  }

  if (/\b(example|sample|demo|template|preview)\b/.test(lower)) {
    return { kind: "example", name: null };
  }

  return { kind: "request", name: null };
}

function detectListIntent(message: string): boolean {
  const lower = message.toLowerCase();
  const hasListVerb =
    /\b(list|lista|names|pangalan|who are|sino|how many|count|bilang|show me all|ipakita lahat|employee roster|headcount|give me|show me|tell me)\b/.test(
      lower
    );
  const hasEmployeeNoun =
    /\b(employees|staff|team|workers|personnel|people)\b/.test(lower);
  return hasListVerb && hasEmployeeNoun;
}

function detectTopRatedIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return /\b(top|best|highest|pinaka|magaling|rating|performance|top performer)\b/.test(
    lower
  );
}

function detectMissingDataIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return /\b(missing|kulang|incomplete|no bank|walang bank|no birthdate|walang birthdate|pending setup)\b/.test(
    lower
  );
}

function detectOpenRunsIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return /\b(open runs|pending runs|pending approval|approvals|awaiting approval|draft runs|rejected runs|list runs|payroll runs)\b/.test(
    lower
  );
}

function detectLinkIntent(message: string): boolean {
  const lower = message.toLowerCase();
  const wantsLink =
    /\b(link|url|path|open|go to|navigate|take me|click|where|how can i|how do i access|saan|paano|dalhin|pumunta)\b/.test(
      lower
    );
  const wantsPage =
    /\b(bank|banking|settings|payroll|compensation|claims|benefits|analytics|dashboard|profile|missing bank|account setup)\b/.test(
      lower
    );
  return wantsLink && wantsPage;
}

function looksLikeEmployeeName(message: string): boolean {
  const s = message.trim().replace(/[.?!,]+$/, "");
  if (s.length < 2 || s.length > 60) return false;
  if (!/^[A-Za-zÑñ.'\-\s]+$/.test(s)) return false;
  if (
    /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|cancel|stop|exit|quit|show me|give me|list|help)$/i.test(
      s
    )
  ) {
    return false;
  }
  return true;
}

export async function airyChat(
  message: string,
  context?: Record<string, any>,
  adminUserId?: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = []
): Promise<AiryStructuredReply> {
  const admin = adminUserId ? await getAdminContextByUserId(adminUserId) : null;
  const firstName = admin?.name?.split(" ")[0] || "Admin";

  if (admin && adminUserId) {
    const verdict = await checkSuspiciousRequest(
      message,
      admin.id,
      admin.name,
      admin.email
    );

    if (verdict.suspicious) {
      return {
        text: verdict.warningMessage || "That request has been logged.",
        forceLogout: verdict.shouldLogout,
        redirectTo: verdict.redirectTo ?? undefined,
      };
    }
  }

  const pending = adminUserId ? await getPendingIntent(adminUserId) : null;

  if (pending?.intent_type === "payslip_employee" && pending.employee_id) {
    const trimmed = message.trim();
    const runMatch = trimmed.match(/(\d{4}-\d{2}-\d{2})|(\d{1,2}[-–]\d{1,2})/);
    const runs = await getEmployeeRuns(pending.employee_id);

    const pickIndex = parseInt(trimmed.replace(/\D/g, ""), 10);
    const picked =
      !isNaN(pickIndex) && pickIndex > 0 && pickIndex <= runs.length
        ? runs[pickIndex - 1]
        : null;

    if (picked) {
      await clearPendingIntent(adminUserId!);
      const result = await generatePayslipImageForEmployee(
        pending.employee_name || "",
        picked.id
      );

      if (!result.ok) {
        return { text: `Could not generate the payslip. ${result.error}` };
      }

      return {
        text: `Payslip for ${result.employeeName} for ${result.periodLabel} is ready. Use Print or Download below the image.`,
        attachment: {
          type: "image",
          url: result.url,
          label: result.label,
          downloadUrl: result.downloadUrl,
          printUrl: result.url,
        },
      };
    }

    if (!runMatch && runs.length > 0) {
      const lines = runs
        .slice(0, 6)
        .map((r, i) => `${i + 1}. ${r.period_start} to ${r.period_end}`)
        .join("\n");
      return {
        text: `Which payroll period should I use for ${pending.employee_name}?\n\n${lines}\n\nReply with the number.`,
      };
    }

    if (runs.length === 0) {
      await clearPendingIntent(adminUserId!);
      return {
        text: `${pending.employee_name} has no processed payslip yet. Process a payroll run that includes them first.`,
      };
    }
  }

  if (
    pending?.intent_type === "payslip_employee" &&
    !pending.employee_id &&
    adminUserId
  ) {
    const asName = message.trim().replace(/[.?!,]+$/, "");

    if (looksLikeEmployeeName(asName)) {
      const emp = await findEmployeeByNameSafe(asName);

      if (!emp) {
        await clearPendingIntent(adminUserId);
        return {
          text: `No active employee matched "${asName}". Try again with the exact full name.`,
        };
      }

      const fullName = `${emp.first_name} ${emp.last_name}`;
      const runs = await getEmployeeRuns(emp.id);

      if (runs.length === 0) {
        await clearPendingIntent(adminUserId);
        return {
          text: `${fullName} has no processed payslip yet. Process a payroll run that includes them first.`,
        };
      }

      if (runs.length === 1) {
        await clearPendingIntent(adminUserId);
        const result = await generatePayslipImageForEmployee(
          fullName,
          runs[0].id
        );
        if (!result.ok) {
          return { text: `Could not generate the payslip. ${result.error}` };
        }
        return {
          text: `Payslip for ${fullName} covering ${result.periodLabel} is ready. Use Print or Download below the image.`,
          attachment: {
            type: "image",
            url: result.url,
            label: result.label,
            downloadUrl: result.downloadUrl,
            printUrl: result.url,
          },
        };
      }

      await setPendingIntent(adminUserId, {
        intent_type: "payslip_employee",
        employee_id: emp.id,
        employee_name: fullName,
      });

      const lines = runs
        .slice(0, 6)
        .map((r, i) => `${i + 1}. ${r.period_start} to ${r.period_end}`)
        .join("\n");

      return {
        text: `Found ${fullName}. Which payroll period?\n\n${lines}\n\nReply with the number.`,
      };
    }

    await clearPendingIntent(adminUserId);
  }

  const intent = detectPayslipIntent(message);

  if (intent) {
    if (intent.kind === "example") {
      const result = await generatePayslipImageForEmployee("__EXAMPLE__");
      if (!result.ok) {
        return { text: `Could not render the sample. ${result.error}` };
      }
      return {
        text: `Here is a sample payslip. Amounts in the sample are placeholders and are not tied to any real employee.`,
        attachment: {
          type: "image",
          url: result.url,
          label: result.label,
          downloadUrl: result.downloadUrl,
          printUrl: result.url,
        },
      };
    }

    if (intent.name) {
      const emp = await findEmployeeByNameSafe(intent.name);

      if (!emp) {
        const result = await generatePayslipImageForEmployee("__EXAMPLE__");
        return {
          text: `No active employee matched "${intent.name}". I rendered a sample payslip instead.`,
          attachment: result.ok
            ? {
                type: "image",
                url: result.url,
                label: result.label,
                downloadUrl: result.downloadUrl,
                printUrl: result.url,
              }
            : undefined,
        };
      }

      const fullName = `${emp.first_name} ${emp.last_name}`;
      const runs = await getEmployeeRuns(emp.id);

      if (runs.length === 0) {
        return {
          text: `${fullName} has no processed payslip yet. Process a payroll run that includes them first.`,
        };
      }

      if (runs.length === 1) {
        const result = await generatePayslipImageForEmployee(
          fullName,
          runs[0].id
        );
        if (!result.ok) {
          return { text: `Could not generate the payslip. ${result.error}` };
        }
        return {
          text: `Payslip for ${fullName} covering ${result.periodLabel} is ready. Use Print or Download below the image.`,
          attachment: {
            type: "image",
            url: result.url,
            label: result.label,
            downloadUrl: result.downloadUrl,
            printUrl: result.url,
          },
        };
      }

      if (adminUserId) {
        await setPendingIntent(adminUserId, {
          intent_type: "payslip_employee",
          employee_id: emp.id,
          employee_name: fullName,
        });
      }

      const lines = runs
        .slice(0, 6)
        .map((r, i) => `${i + 1}. ${r.period_start} to ${r.period_end}`)
        .join("\n");

      return {
        text: `Found ${fullName}. Which payroll period?\n\n${lines}\n\nReply with the number.`,
      };
    }

    if (adminUserId) {
      await setPendingIntent(adminUserId, {
        intent_type: "payslip_employee",
        employee_id: null,
        employee_name: null,
      });
    }

    return {
      text: `Which employee? Reply with the full name, for example "generate payslip for Juan Dela Cruz".`,
    };
  }

  if (detectLinkIntent(message) && adminUserId) {
    const result = await resolveModuleLink(message, adminUserId);

    if (!result.ok) {
      if (result.reason === "wrong_role") {
        return {
          text: `Your role does not include access to that page. Contact your HR admin if you believe this is incorrect.`,
          accessDenied: true,
          blocks: [
            {
              kind: "link",
              label: "Restricted",
              full: "Restricted page",
              href: "#",
              allowed: false,
              reason: "wrong_role",
            },
          ],
        };
      }

      if (result.reason === "no_session") {
        return {
          text: `I can't verify your session right now. Please sign in again.`,
          accessDenied: true,
        };
      }

      return {
        text: `I couldn't match that to a page. Try saying "open bank details" or "go to payroll runs".`,
      };
    }

    const mod = result.module!;

    return {
      text: `Here is the link to ${mod.full}.`,
      blocks: [
        {
          kind: "link",
          label: mod.label,
          full: mod.full,
          href: mod.href,
          allowed: true,
        },
      ],
    };
  }

  if (detectListIntent(message)) {
    const [employees, counts] = await Promise.all([
      fetchActiveEmployeeNames(),
      fetchEmployeeCounts(),
    ]);

    if (employees.length > 0) {
      const blocks: AiryBlock[] = [
        { kind: "heading", text: `Active employees for ${firstName}` },
        {
          kind: "employee_table",
          items: employees.map((e) => {
            const warnings: Array<"missing_bank" | "missing_birthdate"> = [];
            if (!e.has_bank) warnings.push("missing_bank");
            if (!e.has_birthdate) warnings.push("missing_birthdate");
            return {
              name: `${e.first_name} ${e.last_name}`,
              employee_id_number: e.employee_id_number,
              position: e.job_title,
              department: e.department,
              warnings,
            };
          }),
        },
        {
          kind: "summary",
          items: [
            { label: "Active", value: String(counts.active), tint: "success" },
            { label: "On leave", value: String(counts.on_leave) },
            { label: "Inactive", value: String(counts.inactive) },
          ],
        },
      ];

      const missingBank = employees.filter((e) => !e.has_bank).length;
      const missingBirth = employees.filter((e) => !e.has_birthdate).length;
      const parts: string[] = [];
      if (missingBank > 0) parts.push(`${missingBank} missing bank details`);
      if (missingBirth > 0) parts.push(`${missingBirth} missing birthdate`);

      return {
        text:
          parts.length > 0
            ? `${employees.length} active employees. ${parts.join(", ")}.`
            : `${employees.length} active employees, all complete.`,
        blocks,
      };
    }

    const { data: raw } = await supabaseAdmin
      .from("hr1_employees")
      .select("id, first_name, last_name, employee_id_number, status")
      .eq("status", "active")
      .limit(50);

    if (!raw || raw.length === 0) {
      return { text: `There are no active employees on record.` };
    }

    const fallbackBlocks: AiryBlock[] = [
      { kind: "heading", text: `Active employees for ${firstName}` },
      {
        kind: "employee_table",
        items: raw.map((r: any) => ({
          name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(),
          employee_id_number: r.employee_id_number ?? "",
          position: null,
          department: null,
          warnings: [] as Array<"missing_bank" | "missing_birthdate">,
        })),
      },
    ];

    return {
      text: `${raw.length} active employees.`,
      blocks: fallbackBlocks,
    };
  }

  if (detectTopRatedIntent(message)) {
    const top = await fetchTopRatedEmployees(5);
    if (top.length === 0) {
      return {
        text: `No finalized performance ratings are available yet. Finalize appraisals in the Performance module first.`,
      };
    }

    const blocks: AiryBlock[] = [
      { kind: "heading", text: `Top performers by finalized rating` },
      {
        kind: "top_rated_table",
        items: top.map((t) => ({
          name: t.employee_name,
          employee_id_number: t.employee_id_number,
          department: t.department,
          rating: t.performance_rating,
          letter_grade: t.letter_grade,
        })),
      },
    ];

    return {
      text: `${top.length} top-rated employees.`,
      blocks,
    };
  }

  if (detectMissingDataIntent(message)) {
    const [noBank, noBirth] = await Promise.all([
      fetchEmployeesWithoutBank(),
      fetchEmployeesWithoutBirthdate(),
    ]);

    if (noBank.length === 0 && noBirth.length === 0) {
      return {
        text: `All active employees have complete bank details and birthdates on file.`,
      };
    }

    const blocks: AiryBlock[] = [];

    if (noBank.length > 0) {
      blocks.push({ kind: "heading", text: `Missing bank details` });
      blocks.push({
        kind: "employee_table",
        items: noBank.map((e) => ({
          name: `${e.first_name} ${e.last_name}`,
          employee_id_number: e.employee_id_number,
          position: e.job_title,
          department: e.department,
          warnings: ["missing_bank" as const],
        })),
      });
    }

    if (noBirth.length > 0) {
      blocks.push({ kind: "heading", text: `Missing birthdate` });
      blocks.push({
        kind: "employee_table",
        items: noBirth.map((e) => ({
          name: `${e.first_name} ${e.last_name}`,
          employee_id_number: e.employee_id_number,
          position: e.job_title,
          department: e.department,
          warnings: ["missing_birthdate" as const],
        })),
      });
    }

    blocks.push({
      kind: "summary",
      items: [
        {
          label: "Missing bank",
          value: String(noBank.length),
          tint: noBank.length > 0 ? "warning" : "success",
        },
        {
          label: "Missing birthdate",
          value: String(noBirth.length),
          tint: noBirth.length > 0 ? "warning" : "success",
        },
      ],
    });

    return {
      text: `${noBank.length} missing bank details, ${noBirth.length} missing birthdate.`,
      blocks,
    };
  }

  if (detectOpenRunsIntent(message)) {
    const [open, pendingRuns, rejected] = await Promise.all([
      fetchOpenRuns(),
      fetchPendingApprovals(),
      fetchRejectedRuns(),
    ]);

    if (
      open.length === 0 &&
      pendingRuns.length === 0 &&
      rejected.length === 0
    ) {
      return { text: `No open payroll runs at the moment.` };
    }

    const blocks: AiryBlock[] = [];

    if (open.length > 0) {
      blocks.push({ kind: "heading", text: `Open runs` });
      blocks.push({
        kind: "run_table",
        items: open.map((r) => ({
          id: r.id,
          period_start: r.period_start,
          period_end: r.period_end,
          approval_status: r.approval_status,
        })),
      });
    }

    if (rejected.length > 0) {
      blocks.push({ kind: "heading", text: `Rejected runs` });
      blocks.push({
        kind: "run_table",
        items: rejected.map((r) => ({
          id: r.id,
          period_start: r.period_start,
          period_end: r.period_end,
          approval_status: r.approval_status,
          note: r.rejection_reason,
        })),
      });
    }

    return {
      text: `${open.length} open, ${pendingRuns.length} awaiting approval, ${rejected.length} rejected.`,
      blocks,
    };
  }

  const historyForLLM = history.slice(-6);

  try {
    const res = await chat(
      {
        messages: [
          { role: "system", content: buildSystem(admin) },
          ...historyForLLM.map((h) => ({ role: h.role, content: h.content })),
          {
            role: "user",
            content:
              message +
              (context
                ? `\n\nContext:\n${JSON.stringify(context, null, 2)}`
                : ""),
          },
        ],
        temperature: 0.4,
        maxTokens: 700,
      },
      "groq"
    );
    return {
      text: sanitizeReply(
        res.content ||
          "I don't have enough information to answer that. Try asking about employees, runs, or payslips."
      ),
    };
  } catch (err: any) {
    return {
      text: `I couldn't reach the payroll assistant right now. You can still process runs from the Payroll Runs tab.`,
    };
  }
}

export async function airyBriefing(snapshot: any, adminUserId?: string) {
  const admin = adminUserId ? await getAdminContextByUserId(adminUserId) : null;
  const firstName = admin?.name?.split(" ")[0] || "Admin";

  const pending = snapshot?.pending_approvals ?? 0;
  const approved = snapshot?.approved_not_distributed ?? 0;
  const rejected = snapshot?.rejected_runs ?? 0;
  const missingBank = snapshot?.missing_bank ?? 0;
  const drafts = snapshot?.open_draft_runs ?? 0;

  const activeEmployees = snapshot?.active_employees ?? 0;
  const totalPositions = snapshot?.total_positions ?? 0;
  const openForHiring = snapshot?.open_for_hiring ?? 0;
  const uniqueDepartments = snapshot?.unique_departments ?? 0;
  const todayAttendance = snapshot?.today_attendance ?? 0;
  const attendanceRate = snapshot?.attendance_rate ?? 0;
  const ytdNet = snapshot?.ytd_net_pay ?? 0;
  const ytdGross = snapshot?.ytd_gross_pay ?? 0;
  const lastRunNet = snapshot?.last_run_net_pay ?? 0;
  const withBank = snapshot?.with_bank ?? 0;
  const pendingClaims = snapshot?.pending_claims ?? 0;
  const approvedClaims = snapshot?.approved_claims ?? 0;
  const claimsAmount = snapshot?.claims_pending_amount ?? 0;
  const monthName = new Date(
    new Date().getFullYear(),
    (snapshot?.current_month ?? 1) - 1,
    1
  ).toLocaleDateString("en-US", { month: "long" });

  const pesos = (n: number) =>
    "P" +
    Number(n || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  type Mode =
    | "urgent_blockers"
    | "approvals_waiting"
    | "claims_backlog"
    | "all_clear"
    | "operations_snapshot"
    | "data_quality";

  let mode: Mode = "operations_snapshot";
  const scores: Record<Mode, number> = {
    urgent_blockers: 0,
    approvals_waiting: 0,
    claims_backlog: 0,
    all_clear: 0,
    operations_snapshot: 0,
    data_quality: 0,
  };

  if (rejected > 0) scores.urgent_blockers += 40;
  if (missingBank > 0) scores.urgent_blockers += 30;
  if (drafts > 0) scores.urgent_blockers += 20;

  if (pending > 0) scores.approvals_waiting += 50;
  if (approved > 0) scores.approvals_waiting += 30;

  if (pendingClaims > 0) scores.claims_backlog += 40;
  if (claimsAmount > 0) scores.claims_backlog += 20;

  if (
    pending === 0 &&
    approved === 0 &&
    rejected === 0 &&
    missingBank === 0 &&
    drafts === 0 &&
    pendingClaims === 0
  ) {
    scores.all_clear += 100;
  }

  if (
    activeEmployees > 0 ||
    totalPositions > 0 ||
    ytdNet > 0 ||
    uniqueDepartments > 1
  ) {
    scores.operations_snapshot += 15;
  }

  if (openForHiring > 0) scores.operations_snapshot += 10;
  if (attendanceRate > 0) scores.operations_snapshot += 5;

  if (missingBank > 0 && missingBank <= 3) scores.data_quality += 15;

  let bestScore = -1;
  (Object.keys(scores) as Mode[]).forEach((m) => {
    if (scores[m] > bestScore) {
      bestScore = scores[m];
      mode = m;
    }
  });

  const buildFallback = (): string => {
    switch (mode) {
      case "urgent_blockers":
        return `Good day, ${firstName}. ${
          rejected > 0
            ? `${rejected} payroll run${
                rejected > 1 ? "s were" : " was"
              } rejected and need revision. `
            : ""
        }${
          missingBank > 0
            ? `${missingBank} employee${
                missingBank > 1 ? "s are" : " is"
              } still missing bank details. `
            : ""
        }${
          drafts > 0
            ? `${drafts} draft run${
                drafts > 1 ? "s are" : " is"
              } not processed yet.`
            : ""
        }`.trim();

      case "approvals_waiting":
        return `Good day, ${firstName}. ${
          pending > 0
            ? `${pending} run${
                pending > 1 ? "s are" : " is"
              } waiting for financial approval. `
            : ""
        }${
          approved > 0
            ? `${approved} approved run${
                approved > 1 ? "s are" : " is"
              } ready to distribute.`
            : ""
        }`.trim();

      case "claims_backlog":
        return `Good day, ${firstName}. ${pendingClaims} claim${
          pendingClaims > 1 ? "s are" : " is"
        } pending review${
          claimsAmount > 0 ? `, worth ${pesos(claimsAmount)}` : ""
        }. Settle them before the next run.`;

      case "all_clear":
        return `Good day, ${firstName}. Everything is clear. No pending approvals, no missing bank details, no draft runs, and no pending claims. The payroll pipeline is healthy.`;

      case "data_quality":
        return `Good day, ${firstName}. ${withBank} of ${activeEmployees} employees have complete bank records. ${missingBank} still need attention before the next payout.`;

      default:
        return `Good day, ${firstName}. ${activeEmployees} active employee${
          activeEmployees === 1 ? "" : "s"
        } across ${uniqueDepartments} department${
          uniqueDepartments === 1 ? "" : "s"
        }. YTD net pay is ${pesos(
          ytdNet
        )}. ${attendanceRate}% attendance today.`;
    }
  };

  const fallback = buildFallback();

  const promptsByMode: Record<Mode, string> = {
    urgent_blockers:
      "Task: Write a short morning briefing for a payroll admin. Start with the most urgent blocker (rejected run or missing bank data). Name the count and the specific action. Plain sentences. No bullets, no markdown, no emojis. Under 70 words.",
    approvals_waiting:
      "Task: Write a short morning briefing. Focus on payroll runs awaiting financial approval and approved runs ready to distribute. State counts and next action. Plain sentences. No bullets, no markdown, no emojis. Under 70 words.",
    claims_backlog:
      "Task: Write a short morning briefing. Focus on pending reimbursement claims awaiting review. Mention the count and the total amount if available. Suggest settling before the next run. Plain sentences. No bullets, no markdown, no emojis. Under 70 words.",
    all_clear:
      "Task: Write a short, reassuring morning briefing. Everything is clear today. Mention the general health of the payroll pipeline without inventing numbers. Plain sentences. No bullets, no markdown, no emojis. Under 60 words.",
    data_quality:
      "Task: Write a short morning briefing about employee data completeness. Mention how many employees have complete bank records versus how many still need attention. Plain sentences. No bullets, no markdown, no emojis. Under 70 words.",
    operations_snapshot:
      "Task: Write a short operational snapshot for a payroll admin. Mention active employees, departments, YTD net pay, and today's attendance rate if relevant. Plain sentences. No bullets, no markdown, no emojis. Under 70 words.",
  };

  const headerContext = `Mode: ${mode}\nMonth: ${monthName}`;

  const detailContext = [
    `Active employees: ${activeEmployees}`,
    `Total job positions: ${totalPositions}`,
    `Open for hiring: ${openForHiring}`,
    `Departments in use: ${uniqueDepartments}`,
    `Today's attendance count: ${todayAttendance}`,
    `Attendance rate: ${attendanceRate}%`,
    `YTD gross pay: ${pesos(ytdGross)}`,
    `YTD net pay: ${pesos(ytdNet)}`,
    `Last run net pay: ${pesos(lastRunNet)}`,
    `Employees with complete bank: ${withBank}`,
    `Employees missing bank details: ${missingBank}`,
    `Payroll runs pending approval: ${pending}`,
    `Payroll runs approved but not distributed: ${approved}`,
    `Payroll runs rejected: ${rejected}`,
    `Payroll drafts not processed: ${drafts}`,
    `Pending reimbursement claims: ${pendingClaims}`,
    `Approved reimbursement claims: ${approvedClaims}`,
    `Pending claims amount: ${pesos(claimsAmount)}`,
  ].join("\n");

  try {
    const text = await ask(
      promptsByMode[mode] +
        "\n\n" +
        headerContext +
        "\n\nSnapshot:\n" +
        detailContext,
      snapshot,
      admin,
      [],
      260
    );
    const cleaned = sanitizeReply(text);
    if (!cleaned || cleaned.length < 10) return fallback;
    if (/no response/i.test(cleaned)) return fallback;
    return cleaned;
  } catch {
    return fallback;
  }
}

export async function airyPreflight(
  ctx: any,
  adminUserId?: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = []
) {
  const admin = adminUserId ? await getAdminContextByUserId(adminUserId) : null;
  return ask(
    "Task: Preflight check before processing. State blockers in plain sentences. End with a plain verdict. Under 100 words. Never repeat sentences.",
    ctx,
    admin,
    history,
    380
  );
}

export async function airyAudit(
  ctx: any,
  adminUserId?: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = []
) {
  const admin = adminUserId ? await getAdminContextByUserId(adminUserId) : null;
  return ask(
    "Task: Post-process audit. Describe anomalies grouped by type in plain sentences. End with one recommendation. Under 120 words. Never repeat sentences.",
    ctx,
    admin,
    history,
    480
  );
}

export async function airyRunSummary(
  ctx: any,
  adminUserId?: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = []
) {
  const admin = adminUserId ? await getAdminContextByUserId(adminUserId) : null;
  return ask(
    "Task: Three-sentence summary of this payroll run. Total payslips, gross, net, employer cost, and one notable point. Plain sentences.",
    ctx,
    admin,
    history,
    280
  );
}

export async function airyDraftRejection(
  ctx: any,
  adminUserId?: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = []
) {
  const admin = adminUserId ? await getAdminContextByUserId(adminUserId) : null;
  return ask(
    "Task: Draft a professional one-paragraph rejection reason. Cite the exact figure that caused concern. Under 60 words. Plain sentences.",
    ctx,
    admin,
    history,
    200
  );
}

export async function airyRecoveryPlan(
  ctx: any,
  adminUserId?: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = []
) {
  const admin = adminUserId ? await getAdminContextByUserId(adminUserId) : null;
  return ask(
    "Task: Financial rejected this run. List fix steps as plain sentences separated by periods. Under 120 words. Never repeat.",
    ctx,
    admin,
    history,
    380
  );
}

export async function airyPayslipExplainer(
  ctx: any,
  adminUserId?: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = []
) {
  const admin = adminUserId ? await getAdminContextByUserId(adminUserId) : null;
  return ask(
    "Task: Explain where each peso on this payslip came from, in plain sentences. Under 140 words.",
    ctx,
    admin,
    history,
    380
  );
}

export async function airyDistributeCheck(
  ctx: any,
  adminUserId?: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = []
) {
  const admin = adminUserId ? await getAdminContextByUserId(adminUserId) : null;
  return ask(
    "Task: Pre-distribution sanity check. Describe issues in plain sentences. End with a plain verdict. Under 90 words. Never repeat.",
    ctx,
    admin,
    history,
    280
  );
}

export async function airyBudgetGuard(
  ctx: any,
  adminUserId?: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = []
) {
  const admin = adminUserId ? await getAdminContextByUserId(adminUserId) : null;
  return ask(
    "Task: Budget guard. Remaining before and after this run. Whether it stays within plan. Plain sentences under 60 words.",
    ctx,
    admin,
    history,
    200
  );
}

export async function airyAnomalyDeep(
  ctx: any,
  adminUserId?: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = []
) {
  const admin = adminUserId ? await getAdminContextByUserId(adminUserId) : null;
  return ask(
    "Task: Deep anomaly analysis. Describe patterns and give three plain hypotheses. Under 200 words.",
    ctx,
    admin,
    history,
    580
  );
}
