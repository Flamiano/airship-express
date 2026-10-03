import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    const user = "crbc.airshipexpress@gmail.com";
    const pass = "oetcyjmonkbxfeeq";

    if (!user || !pass) {
      throw new Error("CRBC Email service is not configured (EMAIL_CRBC_USER, EMAIL_CRBC_APP_PASSWORD)");
    }

    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user,
        pass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    });
  }
  return transporter;
}

export interface SendMfaCodeEmailOptions {
  to: string;
  otp: string;
  userName?: string;
  expiresIn?: number;
  purpose: "login" | "enable" | "disable";
}

export async function sendMfaCodeEmail(
  options: SendMfaCodeEmailOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { to, otp, userName, expiresIn = 5, purpose } = options;

    if (!to || !to.includes("@")) {
      throw new Error("Invalid email address format");
    }

    const transporter = getTransporter();

    // Verify transporter connection
    await transporter.verify();

    const purposeText = {
      login: "Sign In",
      enable: "Enable MFA",
      disable: "Disable MFA",
    }[purpose];

    const mailOptions = {
      from: `"${process.env.EMAIL_CRBC_FROM_NAME || "Airship Express CRBC"}" <${process.env.EMAIL_CRBC_USER}>`,
      to,
      subject: `Your ${purposeText} Verification Code`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <!-- Logo -->
              <div style="text-align: center; margin-bottom: 32px;">
                <div style="display: inline-block; width: 48px; height: 48px; background: #2563eb; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                    <line x1="12" y1="22.08" x2="12" y2="12" />
                  </svg>
                </div>
              </div>

              <h1 style="color: #111827; font-size: 24px; font-weight: 600; margin: 0 0 16px; text-align: center;">
                ${purposeText} Verification Code
              </h1>

              <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin: 0 0 24px; text-align: center;">
                ${userName ? `Hi ${userName},<br>` : ""}
                Your verification code for <strong>${purposeText.toLowerCase()}</strong> is:
              </p>

              <!-- OTP Code -->
              <div style="background: #f3f4f6; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
                <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #2563eb; font-family: 'SF Mono', Monaco, monospace;">
                  ${otp}
                </div>
              </div>

              <p style="color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 24px 0 0; text-align: center;">
                This code expires in <strong>${expiresIn} minutes</strong>.<br>
                If you didn't request this, please ignore this email.
              </p>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">

              <p style="color: #9ca3af; font-size: 12px; line-height: 1.6; margin: 0; text-align: center;">
                Airship Express CRBC
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
${purposeText} Verification Code

${userName ? `Hi ${userName},` : ""}

Your verification code for ${purposeText.toLowerCase()} is: ${otp}

This code expires in ${expiresIn} minutes.
If you didn't request this, please ignore this email.

---
Airship Express CRBC
      `.trim(),
    };

    const info = await transporter.sendMail(mailOptions);

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("MFA email error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}