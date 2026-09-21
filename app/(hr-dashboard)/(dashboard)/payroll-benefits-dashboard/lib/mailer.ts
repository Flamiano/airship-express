import "server-only";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_HR_USER,
    pass: process.env.GMAIL_APP_HR_PASSWORD,
  },
});

const FOOTER = "Airship Express\nBinondo, Manila, Philippines";

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
    `If you did not request this code, ignore this email.`,
    ``,
    FOOTER,
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1c1b1f">
      <p style="margin:0 0 16px;font-size:14px">Hello ${adminName},</p>
      <p style="margin:0 0 16px;font-size:14px;color:#555">
        Your Airship Express verification code for ${label}:
      </p>
      <p style="margin:0 0 16px;font-family:'SF Mono',Consolas,monospace;font-size:28px;font-weight:700;letter-spacing:4px;color:#1c1b1f">${code}</p>
      <p style="margin:0 0 16px;font-size:13px;color:#555">
        This code expires in ${ttlMinutes} minutes. Do not share it with anyone.
      </p>
      <p style="margin:0 0 16px;font-size:13px;color:#555">
        If you did not request this code, ignore this email.
      </p>
      <p style="margin:24px 0 0;color:#8a8a93;font-size:11px;border-top:1px solid #eee;padding-top:16px">
        Airship Express · Binondo, Manila, Philippines
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: `"Airship Express" <${process.env.GMAIL_HR_USER}>`,
    to,
    subject: `Your Airship Express verification code`,
    text,
    html,
    replyTo: process.env.GMAIL_HR_USER,
  });
}

export async function sendLockAlertEmail({
  to,
  adminName,
  unlockTime,
}: {
  to: string;
  adminName: string;
  unlockTime: Date;
}) {
  const timeStr = unlockTime.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const text = [
    `Hello ${adminName},`,
    ``,
    `Your Airship Express account was locked after 3 incorrect verification attempts.`,
    ``,
    `You can request a new code after ${timeStr}.`,
    ``,
    `If this wasn't you, change your password immediately.`,
    ``,
    FOOTER,
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1c1b1f">
      <h2 style="margin:0 0 12px;font-size:18px;color:#b91c1c">Account temporarily locked</h2>
      <p style="margin:0 0 12px;color:#555;font-size:14px">Hello ${adminName},</p>
      <p style="margin:0 0 12px;color:#555;font-size:14px">
        Your Airship Express account was locked after <strong>3 incorrect verification attempts</strong>.
      </p>
      <p style="margin:0 0 12px;color:#555;font-size:14px">
        You can request a new code after <strong>${timeStr}</strong>.
      </p>
      <p style="margin:16px 0 0;color:#8a8a93;font-size:12px">
        If this wasn't you, change your password immediately.
      </p>
      <p style="margin:24px 0 0;color:#8a8a93;font-size:11px;border-top:1px solid #eee;padding-top:16px">
        Airship Express · Binondo, Manila, Philippines
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: `"Airship Express" <${process.env.GMAIL_HR_USER}>`,
    to,
    subject: `Airship Express account temporarily locked`,
    text,
    html,
    replyTo: process.env.GMAIL_HR_USER,
  });
}
