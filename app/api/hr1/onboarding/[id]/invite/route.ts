import { createHash, randomBytes } from "node:crypto";
import nodemailer from "nodemailer";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/app/(hr-dashboard)/supabase/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { data: admin } = await supabaseAdmin.from("hr_admin").select("role").eq("id", user.id).maybeSingle();
  if (!admin || !["super_admin", "hr_recruitment_admin"].includes(admin.role)) {
    return NextResponse.json({ error: "Only HR Recruitment Admins can create onboarding links." }, { status: 403 });
  }

  const { data: onboarding, error: onboardingError } = await supabaseAdmin
    .from("hr1_onboardings").select("id, applicant_id").eq("id", id).maybeSingle();
  if (onboardingError || !onboarding) return NextResponse.json({ error: "Onboarding record was not found." }, { status: 404 });

  const { data: applicant, error: applicantError } = await supabaseAdmin
    .from("hr1_applicants").select("email, first_name, last_name").eq("id", onboarding.applicant_id).maybeSingle();
  if (applicantError || !applicant?.email) return NextResponse.json({ error: "Applicant email is unavailable." }, { status: 409 });

  const form = await request.json().catch(() => ({}));
  const days = Math.max(1, Math.min(14, Number(form?.valid_days) || 7));
  const allowedCategories = new Set(["government_id", "diploma", "academic_record", "sss", "philhealth", "pagibig", "tin", "clearance", "medical", "other_certificate"]);
  const requestedDocuments = Array.isArray(form?.required_documents)
    ? [...new Set(form.required_documents.filter((value: unknown): value is string => typeof value === "string" && allowedCategories.has(value)))]
    : null;
  if (!requestedDocuments?.length || requestedDocuments.length !== form.required_documents.length) {
    return NextResponse.json({ error: "Select at least one valid document category before creating a link." }, { status: 400 });
  }
  const { error: requirementsError } = await supabaseAdmin.from("hr1_onboardings")
    .update({ required_documents: requestedDocuments }).eq("id", id);
  if (requirementsError) return NextResponse.json({ error: "Could not save the requested document checklist." }, { status: 500 });
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const { error: revokeError } = await supabaseAdmin.from("hr1_onboarding_invites")
    .update({ revoked_at: new Date().toISOString() }).eq("onboarding_id", id).is("revoked_at", null);
  if (revokeError) return NextResponse.json({ error: "Could not rotate the previous onboarding link. Apply the HR1 onboarding SQL migration first." }, { status: 500 });

  const { error: insertError } = await supabaseAdmin.from("hr1_onboarding_invites").insert({
    onboarding_id: id, token_hash: tokenHash, email: applicant.email.toLowerCase(),
    expires_at: expiresAt, created_by: user.id,
  });
  if (insertError) return NextResponse.json({ error: "Could not create the onboarding link. Apply the HR1 onboarding SQL migration first." }, { status: 500 });

  const requestUrl = new URL(request.url);
  const isLocalDevelopmentHost =
    requestUrl.hostname === "localhost" ||
    requestUrl.hostname.endsWith(".localhost") ||
    requestUrl.hostname === "127.0.0.1";
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL_HR
    || process.env.NEXT_PUBLIC_SITE_URL
    || process.env.NEXT_PUBLIC_APP_URL;
  // Local HR testing must stay on the local host even when .env.local contains
  // the production URL. Never email a localhost link to an applicant.
  const origin = isLocalDevelopmentHost
    ? requestUrl.origin
    : configuredOrigin
      ? new URL(configuredOrigin).origin
      : requestUrl.origin;
  const url = new URL(`/onboarding/${token}`, origin).toString();
  let emailSent = false;
  // Use the existing shared HR Gmail account when configured. Fall back to the
  // repository's existing SMTP configuration without requiring duplicate credentials.
  const gmailUser = process.env.GMAIL_HR_USER;
  const gmailPass = process.env.GMAIL_APP_HR_PASSWORD;
  const smtpHost = process.env.HR1_SMTP_HOST || process.env.SMTP_HOST;
  const smtpUser = process.env.HR1_SMTP_USER || process.env.SMTP_USER || process.env.EMAIL_USER;
  const smtpPass = process.env.HR1_SMTP_PASS || process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const smtpFrom = process.env.HR1_SMTP_FROM || process.env.SMTP_FROM || process.env.EMAIL_FROM || smtpUser;
  const gmailConfigured = Boolean(gmailUser && gmailPass);
  const smtpConfigured = Boolean(smtpHost && smtpUser && smtpPass && smtpFrom);
  if (!isLocalDevelopmentHost && (gmailConfigured || smtpConfigured)) {
    try {

      const transporter = gmailConfigured
        ? nodemailer.createTransport({
            service: "gmail",
            auth: { user: gmailUser!, pass: gmailPass! },
          })
        : nodemailer.createTransport({
            host: smtpHost!,
            port: Number(process.env.HR1_SMTP_PORT || process.env.SMTP_PORT || 587),
            secure: String(process.env.HR1_SMTP_SECURE || process.env.SMTP_SECURE || "false").toLowerCase() === "true",
            auth: { user: smtpUser!, pass: smtpPass! },
          });

      await transporter.sendMail({
        from: gmailConfigured ? gmailUser : smtpFrom,
        to: applicant.email,
        subject: "Action Required: Complete Your Airship Express Onboarding",
        text: `Dear ${applicant.first_name},\n\nCongratulations on advancing to the onboarding stage with Airship Express.\n\nPlease complete your onboarding form and submit the documents requested by our Human Resources team using your secure, personal link below:\n\n${url}\n\nThis link expires on ${new Date(expiresAt).toLocaleString("en-PH", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Manila" })}. For your privacy, please do not share this link with anyone.\n\nAfter you submit the form and documents, Human Resources will review your submission and contact you if any corrections or additional information are needed.\n\nIf you have questions or believe you received this email in error, please contact the Airship Express Human Resources team.\n\nRegards,\nHuman Resources\nAirship Express`,
      });
      emailSent = true;
    } catch (error) {
      console.error("HR1 onboarding email could not be sent:", error instanceof Error ? error.message : "unknown email error");
    }
  }

  return NextResponse.json({ url, expires_at: expiresAt, email_sent: emailSent }, { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
