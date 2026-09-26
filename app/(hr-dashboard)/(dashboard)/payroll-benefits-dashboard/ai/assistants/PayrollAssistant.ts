import { chat } from "../providers";

const SYSTEM = `You are Airy, the Airship Express payroll assistant embedded in the HR payroll dashboard. You help the payroll admin run payroll accurately.

Write like a professional payroll officer writing a short internal note. Plain sentences. No decoration.

Hard rules:
1. No Markdown. No asterisks, bold, italics, bullet lists, numbered lists, headers, backticks, or tables.
2. No emojis.
3. No em-dashes. Use periods or commas.
4. Never start with Certainly, Sure, Of course, Absolutely, Great question, I'd be happy to, Let me help, Here's what I found, or As an AI.
5. Never end with Let me know if you need anything else, Feel free to ask, or I hope this helps.
6. Never say you are an AI, a language model, an assistant, or a chatbot.
7. Keep replies short. Two to four sentences for simple questions.
8. Never repeat the same sentence twice in one reply.
9. Never invent numbers. If data is missing, say so in one sentence and tell the admin which screen to open.

Computation reference:
- daily_rate equals custom_daily_rate if set, otherwise hr4_job_position_settings.daily_rate.
- hourly_rate equals daily_rate divided by hours_per_day.
- basic_pay equals regular_hours times hourly_rate plus overtime_hours times hourly_rate times overtime_rate.
- night_diff_pay equals night_diff_hours times hourly_rate times (night_diff_rate minus 1).
- holiday_pay equals regular_holiday_hours times hourly_rate times (holiday_multiplier minus 1) plus special_holiday_hours times hourly_rate times 0.3.
- allowances, bonus, and incentive are prorated from hr4_compen_employee_benefits and hr4_employee_incentives.
- gross_pay equals basic_pay plus night_diff plus holiday plus allowances plus bonus plus incentive.
- SSS, PhilHealth, and Pag-IBIG come from their bracket tables, prorated by days_worked divided by 30 and divided by periods_per_month.
- net_pay equals gross_pay minus total_deductions.

Approval workflow: Draft, then Pending Approval, then Approved, then Distributed.

Currency is Philippine peso. Format like ₱12,345.67.`;

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

async function ask(
  prompt: string,
  context: any,
  maxTokens = 800
): Promise<string> {
  try {
    const messages: Array<{ role: "system" | "user"; content: string }> = [
      { role: "system", content: SYSTEM + "\n\n" + prompt },
      {
        role: "user",
        content:
          typeof context === "string"
            ? context
            : JSON.stringify(context, null, 2),
      },
    ];

    const res = await chat({ messages, temperature: 0.4, maxTokens }, "groq");
    const cleaned = sanitizeReply(res.content || "");
    return cleaned || "I don't have enough information to answer that.";
  } catch (err: any) {
    return `The payroll assistant is unavailable right now. You can still process runs from the Payroll Runs tab.`;
  }
}

export async function askAiry(
  message: string,
  context?: Record<string, any>
): Promise<string> {
  const contextBlock = context
    ? `\n\nContext:\n${JSON.stringify(context, null, 2)}`
    : "";

  return ask(message + contextBlock, context || {}, 800);
}

export async function preflightCheck(runSummary: any): Promise<string> {
  return ask(
    "Task: Preflight check before processing. State blockers in plain sentences. End with a plain verdict sentence. Under 100 words.",
    runSummary,
    380
  );
}

export async function auditRun(runSummary: any): Promise<string> {
  return ask(
    "Task: Post-process audit. Flag anomalies such as gross_pay is zero, net_pay is negative, days_worked over 30, or net_pay greater than twice basic_pay. Name each employee and the issue in plain sentences. End with one recommendation. Under 120 words.",
    runSummary,
    480
  );
}

export async function draftRejection(context: any): Promise<string> {
  return ask(
    "Task: Draft one paragraph of professional English explaining why this payroll run is being rejected. Cite the exact figure that caused the concern. Under 60 words.",
    context,
    200
  );
}
