import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
    if (!transporter) {
        const user = process.env.EMAIL_SUPPLYCHAIN_USER;
        const pass = process.env.EMAIL_SUPPLYCHAIN_PASS;

        if (!user || !pass) {
            throw new Error('Email service is not configured');
        }

        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: user,
                pass: pass,
            },
            connectionTimeout: 10000,
            greetingTimeout: 5000,
            socketTimeout: 10000,
        });
    }
    return transporter;
}

export interface SendOTPEmailOptions {
    to: string;
    otp: string;
    userName?: string;
    expiresIn?: number;
}

export async function sendOTPEmail(
    optionsOrTo: SendOTPEmailOptions | string,
    legacyOtp?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
        const { to, otp, userName, expiresIn = 5 } =
            typeof optionsOrTo === 'string'
                ? { to: optionsOrTo, otp: legacyOtp || '', userName: undefined, expiresIn: 5 }
                : optionsOrTo;

        if (!to || !to.includes('@')) {
            throw new Error('Invalid email address format');
        }

        const transporter = getTransporter();

        // verify transporter connection
        await transporter.verify();

        const mailOptions = {
            from: `"Supply Chain Management" <${process.env.EMAIL_SUPPLYCHAIN_USER}>`,
            to: to,
            subject: 'Your Supply Chain OTP Code',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body {
                            font-family: Arial, Helvetica, sans-serif;
                            line-height: 1.6;
                            color: #333;
                            max-width: 600px;
                            margin: 0 auto;
                            padding: 20px;
                        }
                        .header {
                            background: linear-gradient(135deg, #1a1a2e, #16213e);
                            color: white;
                            padding: 30px 20px;
                            text-align: center;
                            border-radius: 10px 10px 0 0;
                        }
                        .header h1 {
                            margin: 0;
                            font-size: 24px;
                            font-weight: 600;
                        }
                        .content {
                            background: #f8f9fa;
                            padding: 30px 20px;
                            border-radius: 0 0 10px 10px;
                            border: 1px solid #e9ecef;
                            border-top: none;
                        }
                        .otp-box {
                            background: white;
                            padding: 20px;
                            text-align: center;
                            border-radius: 8px;
                            border: 2px dashed #1a1a2e;
                            margin: 20px 0;
                        }
                        .otp-code {
                            font-size: 48px;
                            font-weight: bold;
                            letter-spacing: 8px;
                            color: #1a1a2e;
                            font-family: 'Courier New', monospace;
                        }
                        .info-box {
                            background: #e9ecef;
                            padding: 15px;
                            border-radius: 6px;
                            margin: 20px 0;
                            font-size: 14px;
                        }
                        .footer {
                            text-align: center;
                            font-size: 12px;
                            color: #6c757d;
                            margin-top: 20px;
                            padding-top: 20px;
                            border-top: 1px solid #e9ecef;
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>📦 Supply Chain Management</h1>
                        <p style="margin: 5px 0 0; opacity: 0.8; font-size: 14px;">Secure Access Verification</p>
                    </div>
                    
                    <div class="content">
                        ${userName ? `<p>Hello <strong>${userName}</strong>,</p>` : '<p>Hello,</p>'}
                        
                        <p>You have requested to access the Supply Chain Management System. Please use the following One-Time Password (OTP) to complete your verification:</p>
                        
                        <div class="otp-box">
                            <div class="otp-code">${otp}</div>
                            <p style="margin: 10px 0 0; font-size: 14px; color: #6c757d;">
                                This code will expire in <strong>${expiresIn} minutes</strong>
                            </p>
                        </div>
                        
                        <div class="info-box">
                            <strong>📌 Security Notice:</strong>
                            <ul style="margin: 10px 0 0; padding-left: 20px;">
                                <li>This OTP is valid for one-time use only</li>
                                <li>Do not share this code with anyone</li>
                                <li>If you didn't request this, please ignore this email</li>
                            </ul>
                        </div>
                        
                        <p style="font-size: 14px; margin-top: 20px;">
                            If you have any issues, please contact IT support.
                        </p>
                        
                        <div class="footer">
                            <p>This is an automated message, please do not reply to this email.</p>
                            <p>&copy; ${new Date().getFullYear()} Supply Chain Management System. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
        };

        const info = await transporter.sendMail(mailOptions);

        return { success: true, messageId: info.messageId };
    } catch (error: any) {
        throw new Error(`Failed to send OTP email: ${error.message}`);
    }
}