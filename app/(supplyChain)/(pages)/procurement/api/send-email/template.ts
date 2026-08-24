// Email template builder

export function buildEmailTemplate({
    poNumber,
    supplierName,
    items,
    totalAmount,
    deliveryDate,
    notes,
    confirmLink,
    senderName = "Procurement Team",
    senderPosition = "Procurement Manager",
    senderEmail = process.env.EMAIL_SUPPLYCHAIN_USER || "",
}: {
    poNumber: string;
    supplierName: string;
    items: Array<{ name: string; quantity: number; unit_price: number; total: number }>;
    totalAmount: number;
    deliveryDate: string;
    notes: string;
    confirmLink: string;
    senderName?: string;
    senderPosition?: string;
    senderEmail?: string;
}) {
    const itemsHtml = items.map(item => `
        <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${item.name}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.quantity}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">₱${(item.unit_price || 0).toLocaleString()}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">₱${item.total.toLocaleString()}</td>
        </tr>
    `).join('');

    return `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>Purchase Order ${poNumber}</title>
    <style>
        /* Reset Styles */
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
        body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #f8fafc; }

        /* Dark Mode Support */
        @media (prefers-color-scheme: dark) {
            body { background-color: #0f172a !important; }
            .email-container { background-color: #1e293b !important; border-color: #334155 !important; }
            .text-main { color: #f8fafc !important; }
            .text-muted { color: #94a3b8 !important; }
            .table-header { background-color: #0f172a !important; border-color: #334155 !important; }
            .table-border { border-color: #334155 !important; }
            .info-box { background-color: #0f172a !important; border-color: #334155 !important; }
            .cta-box { background-color: #064e3b !important; border-color: #059669 !important; }
            .footer-divider { border-color: #334155 !important; }
            .signature-name { color: #f8fafc !important; }
        }
    </style>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; padding: 24px 12px;">

    <!-- Center Wrapper -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
            <td align="center">
                <!-- Main Container Card -->
                <div class="email-container" style="max-width: 600px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                    
                    <!-- Gradient Hero Header -->
                    <div style="background: linear-gradient(135deg, #ec4899 0%, #be185d 100%); padding: 32px 24px; text-align: center; color: #ffffff;">
                        <span style="display: inline-block; background: rgba(255, 255, 255, 0.2); padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Official Document</span>
                        <h1 style="margin: 0; font-size: 26px; font-weight: 800; tracking-tight: -0.025em;">Purchase Order</h1>
                        <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.95; font-weight: 500;">Ref: <strong>${poNumber}</strong></p>
                    </div>

                    <!-- Email Body -->
                    <div style="padding: 28px 24px;">
                        
                        <!-- Greeting -->
                        <p class="text-main" style="font-size: 15px; margin-top: 0; margin-bottom: 16px; color: #334155;">
                            Dear <strong>${supplierName}</strong>,
                        </p>
                        <p class="text-muted" style="font-size: 14px; margin-top: 0; margin-bottom: 20px; color: #64748b; line-height: 1.5;">
                            Please accept this purchase order for the items listed below. Review the itemized breakdown and confirm availability at your earliest convenience.
                        </p>

                        <!-- Items Table -->
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: separate; border-spacing: 0; margin: 20px 0; border-radius: 8px; overflow: hidden;" class="table-border">
                            <thead>
                                <tr class="table-header" style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                                    <th style="padding: 12px 14px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">Item</th>
                                    <th style="padding: 12px 14px; text-align: center; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">Qty</th>
                                    <th style="padding: 12px 14px; text-align: right; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">Unit Price</th>
                                    <th style="padding: 12px 14px; text-align: right; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">Total</th>
                                </tr>
                            </thead>
                            <tbody class="text-main" style="font-size: 13px; color: #334155;">
                                ${itemsHtml}
                                
                                <!-- Total Row -->
                                <tr class="table-header" style="background-color: #f8fafc;">
                                    <td colspan="3" style="padding: 14px 14px; text-align: right; font-weight: 700; font-size: 14px; border-top: 2px solid #e2e8f0;">Total Amount:</td>
                                    <td style="padding: 14px 14px; text-align: right; font-weight: 800; font-size: 16px; color: #ec4899; border-top: 2px solid #e2e8f0;">₱${totalAmount.toLocaleString()}</td>
                                </tr>
                            </tbody>
                        </table>

                        <!-- Delivery Metadata Box -->
                        <div class="info-box" style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; margin: 20px 0; font-size: 13px;">
                            <div style="margin-bottom: ${notes ? '8px' : '0'}; flex-direction: row; display: flex; align-items: center;">
                                <span style="color: #64748b; font-weight: 600;">📦 Expected Delivery:</span>
                                <span class="text-main" style="font-weight: 700; margin-left: 6px; color: #0f172a;">${deliveryDate || 'TBD'}</span>
                            </div>
                            ${notes ? `
                            <div style="padding-top: 8px; border-top: 1px dashed #cbd5e1;">
                                <span style="color: #64748b; font-weight: 600;">📝 Notes:</span>
                                <span class="text-main" style="color: #334155; margin-left: 4px;">${notes}</span>
                            </div>` : ''}
                        </div>

                        <!-- CTA Confirmation Box -->
                        <div class="cta-box" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 20px; border-radius: 10px; margin: 24px 0; text-align: center;">
                            <p class="text-main" style="margin: 0 0 12px; font-size: 14px; font-weight: 700; color: #166534;">
                                Please confirm receipt of this order:
                            </p>
                            <a href="${confirmLink}" target="_blank" style="display: inline-block; padding: 12px 28px; background-color: #22c55e; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; box-shadow: 0 2px 4px rgba(34, 197, 94, 0.2);">
                                ✅ Confirm Purchase Order
                            </a>
                            <p class="text-muted" style="margin: 10px 0 0; font-size: 11px; color: #64748b;">
                                Click the button above to automatically verify and confirm this PO.
                            </p>
                        </div>

                        <!-- Footer with Sender Details -->
                        <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #f1f5f9;" class="footer-divider">
                            <p class="text-main" style="margin: 0 0 4px; font-size: 13px; color: #475569;">Best regards,</p>
                            
                            <!-- Sender Name -->
                            <p class="signature-name" style="margin: 0; font-size: 15px; font-weight: 700; color: #0f172a;">
                                ${senderName}
                            </p>
                            
                            <!-- Sender Position -->
                            <p class="text-muted" style="margin: 2px 0 0; font-size: 13px; color: #64748b; font-weight: 500;">
                                ${senderPosition}
                            </p>
                            
                            <!-- Sender Email -->
                            ${senderEmail ? `
                            <p class="text-muted" style="margin: 2px 0 0; font-size: 12px; color: #94a3b8;">
                                📧 ${senderEmail}
                            </p>` : ''}
                            
                            <!-- Company Name -->
                            <p class="text-muted" style="margin: 6px 0 0; font-size: 12px; color: #94a3b8; font-weight: 500; letter-spacing: 0.5px;">
                                AirshipExpress · Procurement Department
                            </p>
                        </div>

                    </div>
                </div>

                <!-- Footer Disclaimer -->
                <div style="text-align: center; margin-top: 20px; padding: 0 10px;">
                    <p style="font-size: 11px; color: #94a3b8; margin: 0;">
                        This is an automated operational message sent by the AirshipExpress Procurement System.
                    </p>
                    <p style="font-size: 10px; color: #cbd5e1; margin: 4px 0 0;">
                        Please do not reply to this email directly. For inquiries, contact the procurement team.
                    </p>
                </div>
            </td>
        </tr>
    </table>

</body>
</html>
    `;
}