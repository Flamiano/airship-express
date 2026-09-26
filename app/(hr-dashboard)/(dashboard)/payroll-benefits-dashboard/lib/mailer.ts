import "server-only";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_HR_USER,
    pass: process.env.GMAIL_APP_HR_PASSWORD,
  },
  pool: true,
  maxConnections: 3,
  maxMessages: 100,
});

const FROM_NAME = "Airship Express HR";
const AIRY_FROM_NAME = "Airy AI — Airship Express";
const FROM_EMAIL = process.env.GMAIL_HR_USER!;
const REPLY_TO = process.env.GMAIL_HR_USER!;
const FOOTER = "Airship Express\nBinondo, Manila, Philippines";

function antiSpamHeaders() {
  return {
    "List-Unsubscribe": `<mailto:${REPLY_TO}?subject=unsubscribe>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    "X-Mailer": "Airship Express HR System",
    "X-Priority": "3",
    Precedence: "bulk",
  };
}

function esc(input: string | null | undefined): string {
  if (input === null || input === undefined) return "";
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendPayslipEmail({
  to,
  employeeName,
  periodStart,
  periodEnd,
  netPay,
  portalUrl,
  employeeIdNumber,
}: {
  to: string;
  employeeName: string;
  periodStart: string;
  periodEnd: string;
  netPay: number;
  portalUrl: string;
  employeeIdNumber: string;
}) {
  const periodLabel = `${new Date(periodStart).toLocaleDateString("en-PH", {
    month: "long",
    day: "numeric",
  })} – ${new Date(periodEnd).toLocaleDateString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })}`;

  const netPayFormatted = `₱${Number(netPay || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
  })}`;

  const text = [
    `Hello ${employeeName},`,
    ``,
    `Your payslip for ${periodLabel} is now available.`,
    ``,
    `Employee ID: ${employeeIdNumber}`,
    `Net Pay: ${netPayFormatted}`,
    ``,
    `View your payslip here:`,
    portalUrl,
    ``,
    `You will be asked for your password. Your default password is your`,
    `birthdate in MMDDYY format (example: April 08, 2005 → 040805).`,
    ``,
    FOOTER,
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1c1b1f;background:#ffffff">
      <div style="border-bottom:2px solid #e5167e;padding-bottom:12px;margin-bottom:20px">
        <h1 style="margin:0;font-size:20px;color:#1c1b1f">Airship Express</h1>
        <p style="margin:4px 0 0;font-size:12px;color:#6b6b76">Payslip Notification</p>
      </div>
      <p style="margin:0 0 16px;font-size:14px">Hello ${esc(employeeName)},</p>
      <p style="margin:0 0 16px;font-size:14px;color:#4a4a52">
        Your payslip for <strong>${esc(periodLabel)}</strong> is now available.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;border:1px solid #eaeaea">
        <tr>
          <td style="padding:10px 12px;background:#f7f7f9;font-size:12px;color:#6b6b76;width:40%">Employee ID</td>
          <td style="padding:10px 12px;font-size:13px;font-weight:600">${esc(
            employeeIdNumber
          )}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;background:#f7f7f9;font-size:12px;color:#6b6b76;border-top:1px solid #eaeaea">Net Pay</td>
          <td style="padding:10px 12px;font-size:13px;font-weight:700;color:#0b8f6b;border-top:1px solid #eaeaea">${netPayFormatted}</td>
        </tr>
      </table>
      <p style="margin:16px 0;font-size:14px">
        <a href="${portalUrl}" style="display:inline-block;background:#e5167e;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;font-size:14px">
          View Payslip
        </a>
      </p>
      <div style="margin:16px 0;padding:12px;background:#fff7ed;border-left:3px solid #f59e0b;font-size:12px;color:#7c4a03;border-radius:4px">
        <strong>Password:</strong> Your default password is your birthdate in <strong>MMDDYY</strong> format.<br>
        Example: April 08, 2005 → <strong>040805</strong>
      </div>
      <p style="margin:24px 0 0;color:#8a8a93;font-size:11px;border-top:1px solid #eee;padding-top:16px">
        Airship Express · Binondo, Manila, Philippines<br>
        This is an automated message. Do not reply to this email.
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to,
    replyTo: REPLY_TO,
    subject: `Your Payslip for ${periodLabel} — Airship Express`,
    text,
    html,
    headers: antiSpamHeaders(),
  });
}

export async function sendPayslipBatchSummary({
  to,
  adminName,
  periodLabel,
  sentCount,
  failedCount,
  failedList,
}: {
  to: string;
  adminName: string;
  periodLabel: string;
  sentCount: number;
  failedCount: number;
  failedList: { name: string; email: string; reason: string }[];
}) {
  const rows = failedList
    .map(
      (f) =>
        `<tr><td style="padding:6px 10px;border:1px solid #eee;font-size:12px">${esc(
          f.name
        )}</td><td style="padding:6px 10px;border:1px solid #eee;font-size:12px">${esc(
          f.email
        )}</td><td style="padding:6px 10px;border:1px solid #eee;font-size:12px;color:#b91c1c">${esc(
          f.reason
        )}</td></tr>`
    )
    .join("");

  const html = `
    <div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#1c1b1f">
      <h2 style="margin:0 0 12px;font-size:18px">Payslip Distribution Report</h2>
      <p style="font-size:14px;color:#4a4a52">Hello ${esc(adminName)},</p>
      <p style="font-size:14px;color:#4a4a52">Distribution for <strong>${esc(
        periodLabel
      )}</strong> has completed.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr>
          <td style="padding:10px 12px;background:#ecfdf5;font-size:13px">Successfully sent</td>
          <td style="padding:10px 12px;background:#ecfdf5;font-size:13px;font-weight:700;color:#0b8f6b;text-align:right">${sentCount}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;background:#fef2f2;font-size:13px">Failed</td>
          <td style="padding:10px 12px;background:#fef2f2;font-size:13px;font-weight:700;color:#b91c1c;text-align:right">${failedCount}</td>
        </tr>
      </table>
      ${
        failedCount > 0
          ? `<h3 style="font-size:14px;margin:20px 0 8px">Failed Deliveries</h3>
             <table style="width:100%;border-collapse:collapse">
               <thead><tr>
                 <th style="padding:6px 10px;border:1px solid #eee;text-align:left;font-size:11px;background:#f7f7f9">Employee</th>
                 <th style="padding:6px 10px;border:1px solid #eee;text-align:left;font-size:11px;background:#f7f7f9">Email</th>
                 <th style="padding:6px 10px;border:1px solid #eee;text-align:left;font-size:11px;background:#f7f7f9">Reason</th>
               </tr></thead>
               <tbody>${rows}</tbody>
             </table>`
          : ""
      }
      <p style="margin:24px 0 0;color:#8a8a93;font-size:11px;border-top:1px solid #eee;padding-top:16px">
        Airship Express · Binondo, Manila, Philippines
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to,
    replyTo: REPLY_TO,
    subject: `Payslip Distribution Report — ${periodLabel}`,
    html,
    headers: antiSpamHeaders(),
  });
}

export async function sendOtpEmail({
  to,
  code,
  purpose,
  adminName,
  ttlMinutes = 5,
}: {
  to: string;
  code: string;
  purpose:
    | "merit"
    | "bonus"
    | "merit_delete"
    | "bonus_delete"
    | "benefit"
    | "benefit_delete"
    | "claim"
    | "claim_delete";
  adminName: string;
  ttlMinutes?: number;
}) {
  const labels: Record<string, string> = {
    merit: "Merit Plan",
    bonus: "Bonus Allocation",
    merit_delete: "Merit Plan Deletion",
    bonus_delete: "Bonus Deletion",
    benefit: "Benefit",
    benefit_delete: "Benefit Deletion",
    claim: "New Claim Submission",
    claim_delete: "Claim Deletion",
  };
  const label = labels[purpose] || "Verification";

  const text = [
    `Hello ${adminName},`,
    ``,
    `Your Airship Express verification code for ${label}:`,
    ``,
    code,
    ``,
    `This code expires in ${ttlMinutes} minutes. Do not share it with anyone.`,
    ``,
    FOOTER,
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1c1b1f">
      <p style="margin:0 0 16px;font-size:14px">Hello ${esc(adminName)},</p>
      <p style="margin:0 0 16px;font-size:14px;color:#555">Your Airship Express verification code for ${esc(
        label
      )}:</p>
      <p style="margin:0 0 16px;font-family:'SF Mono',Consolas,monospace;font-size:28px;font-weight:700;letter-spacing:4px">${code}</p>
      <p style="margin:0 0 16px;font-size:13px;color:#555">This code expires in ${ttlMinutes} minutes.</p>
      <p style="margin:24px 0 0;color:#8a8a93;font-size:11px;border-top:1px solid #eee;padding-top:16px">
        Airship Express · Binondo, Manila, Philippines
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to,
    replyTo: REPLY_TO,
    subject: `Your Airship Express verification code`,
    text,
    html,
    headers: antiSpamHeaders(),
  });
}

export async function sendSecurityAlertEmail({
  to,
  recipientName,
  offenderName,
  offenderEmail,
  offenderRole,
  intent,
  severity,
  attemptNumber,
  totalAttemptsToday,
  messageText,
  attemptsTimeline,
}: {
  to: string;
  recipientName: string;
  offenderName: string;
  offenderEmail: string;
  offenderRole: string;
  intent: string;
  severity: string;
  attemptNumber: number;
  totalAttemptsToday: number;
  messageText: string;
  attemptsTimeline: Array<{
    at: string;
    message: string;
    intent: string;
    severity: string;
  }>;
}) {
  const now = new Date();
  const timeStr = now.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  });

  const intentLabel = intent
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c: string) => c.toUpperCase());

  const severityColor = severity === "critical" ? "#b91c1c" : "#b45309";
  const severityLabel = severity.toUpperCase();

  const timelineRows = attemptsTimeline
    .map((a) => {
      const t = new Date(a.at).toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Manila",
      });
      const intentText = a.intent
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c: string) => c.toUpperCase());
      const sev = a.severity === "critical" ? "CRITICAL" : "WARNING";
      const sevColor = a.severity === "critical" ? "#b91c1c" : "#b45309";
      return `
        <tr>
          <td style="padding:6px 10px;border:1px solid #eee;font-size:11px;color:#6b6b76;white-space:nowrap">${esc(
            t
          )}</td>
          <td style="padding:6px 10px;border:1px solid #eee;font-size:11px;color:${sevColor};font-weight:700;white-space:nowrap">${sev}</td>
          <td style="padding:6px 10px;border:1px solid #eee;font-size:11px;color:#1c1b1f">${esc(
            intentText
          )}</td>
          <td style="padding:6px 10px;border:1px solid #eee;font-size:11px;color:#1c1b1f;font-family:monospace;word-break:break-word">${esc(
            a.message
          )}</td>
        </tr>`;
    })
    .join("");

  const text = [
    `Hello ${recipientName},`,
    ``,
    `A restricted request was made in the Airy payroll assistant.`,
    ``,
    `Admin: ${offenderName} (${offenderEmail})`,
    `Role: ${offenderRole}`,
    `Attempt Number: ${attemptNumber}`,
    `Total Attempts Today: ${totalAttemptsToday}`,
    `Timestamp: ${timeStr}`,
    `Intent: ${intentLabel}`,
    `Severity: ${severityLabel}`,
    ``,
    `Message: "${messageText}"`,
    ``,
    `If this is expected, no action is required. Otherwise, review the admin's access and follow your internal security policy.`,
    ``,
    FOOTER,
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;max-width:720px;margin:0 auto;padding:24px;color:#1c1b1f">
      <div style="border-bottom:2px solid ${severityColor};padding-bottom:12px;margin-bottom:20px">
        <h1 style="margin:0;font-size:20px;color:#1c1b1f">Security Alert — Airy Payroll Assistant</h1>
        <p style="margin:4px 0 0;font-size:12px;color:#6b6b76">Confidential data access attempt detected</p>
      </div>

      <p style="margin:0 0 16px;font-size:14px">Hello ${esc(recipientName)},</p>
      <p style="margin:0 0 16px;font-size:14px;color:#4a4a52">
        A restricted request was made in the Airy payroll assistant. This is an automated notification sent to all payroll administrators.
      </p>

      <table style="width:100%;border-collapse:collapse;margin:16px 0;border:1px solid #eaeaea">
        <tr>
          <td style="padding:10px 12px;background:#f7f7f9;font-size:12px;color:#6b6b76;width:40%">Admin</td>
          <td style="padding:10px 12px;font-size:13px;font-weight:600">${esc(
            offenderName
          )}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;background:#f7f7f9;font-size:12px;color:#6b6b76;border-top:1px solid #eaeaea">Email</td>
          <td style="padding:10px 12px;font-size:13px;border-top:1px solid #eaeaea">${esc(
            offenderEmail
          )}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;background:#f7f7f9;font-size:12px;color:#6b6b76;border-top:1px solid #eaeaea">Role</td>
          <td style="padding:10px 12px;font-size:13px;border-top:1px solid #eaeaea">${esc(
            offenderRole
          )}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;background:#f7f7f9;font-size:12px;color:#6b6b76;border-top:1px solid #eaeaea">Attempt Number</td>
          <td style="padding:10px 12px;font-size:13px;font-weight:700;color:${severityColor};border-top:1px solid #eaeaea">${attemptNumber} of 3</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;background:#f7f7f9;font-size:12px;color:#6b6b76;border-top:1px solid #eaeaea">Total Attempts (24h)</td>
          <td style="padding:10px 12px;font-size:13px;font-weight:700;color:${severityColor};border-top:1px solid #eaeaea">${totalAttemptsToday}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;background:#f7f7f9;font-size:12px;color:#6b6b76;border-top:1px solid #eaeaea">Timestamp</td>
          <td style="padding:10px 12px;font-size:13px;border-top:1px solid #eaeaea">${esc(
            timeStr
          )}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;background:#f7f7f9;font-size:12px;color:#6b6b76;border-top:1px solid #eaeaea">Detected Intent</td>
          <td style="padding:10px 12px;font-size:13px;font-weight:600;border-top:1px solid #eaeaea">${esc(
            intentLabel
          )}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;background:#f7f7f9;font-size:12px;color:#6b6b76;border-top:1px solid #eaeaea">Severity</td>
          <td style="padding:10px 12px;font-size:13px;font-weight:700;color:${severityColor};border-top:1px solid #eaeaea">${severityLabel}</td>
        </tr>
      </table>

      <div style="margin:16px 0;padding:14px;background:#fef2f2;border-left:3px solid #b91c1c;border-radius:4px">
        <p style="margin:0 0 6px;font-size:11px;color:#b91c1c;font-weight:700;letter-spacing:0.5px">MESSAGE THE ADMIN TYPED</p>
        <p style="margin:0;font-family:monospace;font-size:13px;color:#1c1b1f;word-break:break-word">${esc(
          messageText
        )}</p>
      </div>

      <h3 style="font-size:14px;margin:24px 0 8px;color:#1c1b1f">Attempt History — Last 24 Hours</h3>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr>
            <th style="padding:6px 10px;border:1px solid #eee;text-align:left;font-size:11px;background:#f7f7f9;color:#6b6b76">Time</th>
            <th style="padding:6px 10px;border:1px solid #eee;text-align:left;font-size:11px;background:#f7f7f9;color:#6b6b76">Severity</th>
            <th style="padding:6px 10px;border:1px solid #eee;text-align:left;font-size:11px;background:#f7f7f9;color:#6b6b76">Intent</th>
            <th style="padding:6px 10px;border:1px solid #eee;text-align:left;font-size:11px;background:#f7f7f9;color:#6b6b76">Message</th>
          </tr>
        </thead>
        <tbody>
          ${timelineRows}
        </tbody>
      </table>

      <div style="margin:20px 0 0;padding:12px;background:#fff7ed;border-left:3px solid #f59e0b;font-size:12px;color:#7c4a03;border-radius:4px">
        If this attempt is expected, no action is required. Otherwise, review the admin's permissions and follow your internal data privacy policy.
      </div>

      <p style="margin:24px 0 0;color:#8a8a93;font-size:11px;border-top:1px solid #eee;padding-top:16px">
        Airy AI — Airship Express<br>
        This is an automated security notification from the Airy payroll assistant.
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: `"${AIRY_FROM_NAME}" <${FROM_EMAIL}>`,
    to,
    replyTo: REPLY_TO,
    subject: `Security Alert — ${offenderName} (Attempt ${attemptNumber} of 3)`,
    text,
    html,
    headers: antiSpamHeaders(),
  });
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  const user = process.env.GMAIL_HR_USER;
  const pass = process.env.GMAIL_APP_HR_PASSWORD;
  if (!user || !pass) {
    throw new Error(
      "GMAIL_HR_USER or GMAIL_APP_HR_PASSWORD is not configured."
    );
  }

  await transporter.sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to: opts.to,
    replyTo: REPLY_TO,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    headers: antiSpamHeaders(),
  });
}

export async function sendEmailChangeVerification({
  to,
  adminName,
  code,
  oldEmail,
  ttlMinutes = 10,
}: {
  to: string;
  adminName: string;
  code: string;
  oldEmail: string;
  ttlMinutes?: number;
}) {
  const text = [
    `Hello ${adminName},`,
    ``,
    `Someone requested to change your Airship Express admin email to ${to}.`,
    ``,
    `Your verification code:`,
    ``,
    code,
    ``,
    `This code expires in ${ttlMinutes} minutes. Do not share it with anyone.`,
    ``,
    `If you did not request this, ignore this email and check your account at ${oldEmail}.`,
    ``,
    FOOTER,
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1c1b1f">
      <div style="border-bottom:2px solid #7c3aed;padding-bottom:12px;margin-bottom:20px">
        <h1 style="margin:0;font-size:20px;color:#1c1b1f">Airship Express</h1>
        <p style="margin:4px 0 0;font-size:12px;color:#6b6b76">Email Change Verification</p>
      </div>

      <p style="margin:0 0 16px;font-size:14px">Hello ${esc(adminName)},</p>
      <p style="margin:0 0 16px;font-size:14px;color:#4a4a52">
        Someone requested to change your Airship Express admin email to
        <strong>${esc(to)}</strong>.
      </p>

      <p style="margin:0 0 8px;font-size:12px;color:#6b6b76;text-transform:uppercase;letter-spacing:1px">Your verification code</p>
      <p style="margin:0 0 16px;font-family:'SF Mono',Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:6px;color:#7c3aed">${code}</p>

      <p style="margin:0 0 16px;font-size:13px;color:#555">
        This code expires in ${ttlMinutes} minutes. Do not share it with anyone.
      </p>

      <div style="margin:16px 0;padding:12px;background:#fff7ed;border-left:3px solid #f59e0b;font-size:12px;color:#7c4a03;border-radius:4px">
        <strong>If you did not request this change:</strong> ignore this email.
        Your current email (<strong>${esc(
          oldEmail
        )}</strong>) will keep working.
      </div>

      <p style="margin:24px 0 0;color:#8a8a93;font-size:11px;border-top:1px solid #eee;padding-top:16px">
        Airship Express · Binondo, Manila, Philippines<br>
        This is an automated message. Do not reply to this email.
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to,
    replyTo: REPLY_TO,
    subject: `Verify your new Airship Express email`,
    text,
    html,
    headers: antiSpamHeaders(),
  });
}

export async function sendEmailChangeWarning({
  to,
  adminName,
  oldEmail,
  newEmail,
}: {
  to: string;
  adminName: string;
  oldEmail: string;
  newEmail: string;
}) {
  const now = new Date().toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  });

  const text = [
    `Hello ${adminName},`,
    ``,
    `We received a request to change the email on your Airship Express admin account.`,
    ``,
    `Current email: ${oldEmail}`,
    `Requested new email: ${newEmail}`,
    `Requested at: ${now}`,
    ``,
    `The change will NOT take effect until the new address is verified by entering a code sent to it.`,
    ``,
    `If this was you, no action is needed here.`,
    `If this was NOT you, contact your HR administrator immediately.`,
    ``,
    FOOTER,
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1c1b1f">
      <div style="border-bottom:2px solid #b45309;padding-bottom:12px;margin-bottom:20px">
        <h1 style="margin:0;font-size:20px;color:#1c1b1f">Security Notice</h1>
        <p style="margin:4px 0 0;font-size:12px;color:#6b6b76">Email change requested on your account</p>
      </div>

      <p style="margin:0 0 16px;font-size:14px">Hello ${esc(adminName)},</p>
      <p style="margin:0 0 16px;font-size:14px;color:#4a4a52">
        We received a request to change the email on your Airship Express admin account.
      </p>

      <table style="width:100%;border-collapse:collapse;margin:16px 0;border:1px solid #eaeaea">
        <tr>
          <td style="padding:10px 12px;background:#f7f7f9;font-size:12px;color:#6b6b76;width:40%">Current email</td>
          <td style="padding:10px 12px;font-size:13px;font-weight:600">${esc(
            oldEmail
          )}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;background:#f7f7f9;font-size:12px;color:#6b6b76;border-top:1px solid #eaeaea">Requested new email</td>
          <td style="padding:10px 12px;font-size:13px;font-weight:600;border-top:1px solid #eaeaea">${esc(
            newEmail
          )}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;background:#f7f7f9;font-size:12px;color:#6b6b76;border-top:1px solid #eaeaea">Requested at</td>
          <td style="padding:10px 12px;font-size:13px;border-top:1px solid #eaeaea">${esc(
            now
          )}</td>
        </tr>
      </table>

      <div style="margin:16px 0;padding:12px;background:#fff7ed;border-left:3px solid #f59e0b;font-size:12px;color:#7c4a03;border-radius:4px">
        <strong>The change will NOT take effect</strong> until the new address is
        verified by entering a code sent to it.
      </div>

      <div style="margin:16px 0;padding:12px;background:#fef2f2;border-left:3px solid #b91c1c;font-size:12px;color:#7c1d1d;border-radius:4px">
        <strong>If this was NOT you:</strong> contact your HR administrator
        immediately and change your password.
      </div>

      <p style="margin:24px 0 0;color:#8a8a93;font-size:11px;border-top:1px solid #eee;padding-top:16px">
        Airship Express · Binondo, Manila, Philippines<br>
        This is an automated security notification. Do not reply to this email.
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to,
    replyTo: REPLY_TO,
    subject: `Warning: Your Airship Express email is being changed`,
    text,
    html,
    headers: antiSpamHeaders(),
  });
}
