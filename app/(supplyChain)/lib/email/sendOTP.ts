import { sendSupplyChainEmail } from './mailer';

export interface SendOTPEmailOptions {
    to: string;
    otp: string;
    userName?: string;
    expiresIn?: number | string;
}

export async function sendOTPEmail(
    optionsOrTo: SendOTPEmailOptions | string,
    legacyOtp?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
        const { to, otp, userName, expiresIn = '5 minutes' } =
            typeof optionsOrTo === 'string'
                ? { to: optionsOrTo, otp: legacyOtp || '', userName: undefined, expiresIn: '5 minutes' }
                : optionsOrTo;

        const cleanOtp = (otp || '').trim();

        const expiryDisplay = typeof expiresIn === 'number'
            ? (expiresIn < 1 ? `${Math.round(expiresIn * 60)} seconds` : `${expiresIn} minute${expiresIn === 1 ? '' : 's'}`)
            : expiresIn.toString().includes('minute') || expiresIn.toString().includes('second')
                ? expiresIn
                : `${expiresIn} minutes`;

        if (!to || !to.includes('@')) {
            throw new Error('Invalid email address format');
        }

        const plainText = `Your Supply Chain OTP verification code is: ${cleanOtp}\n\nThis code will expire in ${expiryDisplay}.\n\nIf you did not request this OTP, please ignore this email or contact support.`;

        // Inline CSS HTML template for 100% compatibility across Gmail, Outlook, Apple Mail, and Dark Mode
        const html = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Your OTP Verification Code</title>
            </head>
            <body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #1e293b;">
                <!-- Preheader snippet visible in Gmail notification & inbox list -->
                <div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #fff; opacity: 0;">
                    Your OTP code is ${cleanOtp}. Use this code to sign in to Airship Express Supply Chain.
                </div>

                <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0;">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 30px 24px; text-align: center;">
                            <div style="display: inline-block; background-color: #0284c7; color: #ffffff; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                                Airship Express
                            </div>
                            <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">
                                Supply Chain Verification
                            </h1>
                            <p style="margin: 6px 0 0; color: #94a3b8; font-size: 13px;">
                                Secure Access Authentication Code
                            </p>
                        </td>
                    </tr>

                    <!-- Body Content -->
                    <tr>
                        <td style="padding: 32px 24px; background-color: #ffffff;">
                            ${userName ? `<p style="margin: 0 0 14px; font-size: 15px; color: #1e293b;">Hello <strong>${userName}</strong>,</p>` : '<p style="margin: 0 0 14px; font-size: 15px; color: #1e293b;">Hello,</p>'}
                            
                            <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #475569;">
                                You recently requested access to the Supply Chain Management System. Please enter the one-time password (OTP) below to complete your verification:
                            </p>

                            <!-- OTP Box with robust inline styles -->
                            <div style="background-color: #f8fafc; border: 2px dashed #0284c7; border-radius: 10px; padding: 24px 16px; text-align: center; margin: 24px 0;">
                                <div style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
                                    ONE-TIME PASSWORD
                                </div>
                                <div style="font-size: 44px; font-weight: 800; letter-spacing: 10px; color: #0f172a; font-family: 'SF Mono', Monaco, Consolas, 'Courier New', monospace; line-height: 1.2; padding: 4px 0;">
                                    ${cleanOtp}
                                </div>
                                <div style="margin-top: 10px; font-size: 13px; color: #64748b;">
                                    Valid for <strong style="color: #dc2626;">${expiryDisplay}</strong>
                                </div>
                            </div>

                            <!-- Security Notes -->
                            <div style="background-color: #f1f5f9; border-left: 4px solid #0284c7; padding: 14px 16px; border-radius: 0 6px 6px 0; margin-bottom: 20px;">
                                <strong style="font-size: 13px; color: #0f172a; display: block; margin-bottom: 4px;">Security Notice:</strong>
                                <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.5;">
                                    Never share this verification code with anyone. Airship Express staff will never ask for your OTP.
                                </p>
                            </div>

                            <p style="margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.5;">
                                If you did not initiate this request, someone may be attempting to access your account. Please notify your system administrator immediately.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8fafc; padding: 20px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                                This is an automated message from Airship Express Logistics. Please do not reply.
                            </p>
                            <p style="margin: 4px 0 0; font-size: 12px; color: #94a3b8;">
                                &copy; ${new Date().getFullYear()} Airship Express. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
        `;

        const result = await sendSupplyChainEmail({
            to,
            subject: `[Airship Express] Your OTP is ${cleanOtp}`,
            html,
            text: plainText,
            senderName: 'Airship Express Supply Chain',
        });

        return { success: true, messageId: result.messageId };
    } catch (error: any) {
        throw new Error(`Failed to send OTP email: ${error.message}`);
    }
}