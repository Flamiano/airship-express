// Minimalist modern email template builder for Purchase Orders

export function buildEmailTemplate({
    poNumber,
    supplierName,
    items,
    totalAmount,
    deliveryDate,
    notes,
    confirmLink,
    customBodyText,
    senderName = "Procurement Team",
    senderPosition,
    senderRole,
    senderEmail = process.env.EMAIL_SUPPLYCHAIN_USER || "",
}: {
    poNumber: string;
    supplierName: string;
    items: Array<{ name: string; quantity: number; unit_price: number; total: number }>;
    totalAmount: number;
    deliveryDate: string;
    notes: string;
    confirmLink: string;
    customBodyText?: string;
    senderName?: string;
    senderPosition?: string;
    senderRole?: string;
    senderEmail?: string;
}) {
    const resolvedPosition = senderPosition || senderRole || "Procurement Manager";
    const itemsHtml = items.map(item => `
        <tr>
            <td style="padding: 10px 14px; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-size: 13px; font-weight: 500;">${item.name}</td>
            <td style="padding: 10px 14px; border-bottom: 1px solid #f1f5f9; text-align: center; color: #475569; font-size: 13px; font-weight: 600;">${item.quantity}</td>
            <td style="padding: 10px 14px; border-bottom: 1px solid #f1f5f9; text-align: right; color: #64748b; font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;">₱${(item.unit_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td style="padding: 10px 14px; border-bottom: 1px solid #f1f5f9; text-align: right; color: #0f172a; font-weight: 700; font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;">₱${item.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
    `).join('');

    // If custom AI explanation / body text is provided, render formatted paragraphs
    const bodyContentHtml = customBodyText
        ? `
            <div style="background-color: #f8fafc; border-left: 3px solid #ec4899; padding: 14px 16px; border-radius: 0 8px 8px 0; margin-bottom: 22px; font-size: 13.5px; color: #334155; line-height: 1.6; white-space: pre-line;">
                ${customBodyText}
            </div>
          `
        : `
            <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 20px 0;">
                Please review and accept this official purchase order for the item(s) listed below. Confirm availability and expected delivery schedule at your earliest convenience.
            </p>
          `;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light dark">
    <title>Purchase Order ${poNumber}</title>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
            <td align="center">
                
                <!-- Main Card Container -->
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="max-width: 580px; width: 100%; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                    
                    <!-- Clean Minimalist Header -->
                    <tr>
                        <td style="padding: 24px 28px 20px; border-bottom: 1px solid #f1f5f9;">
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td valign="top">
                                        <div style="font-size: 18px; font-weight: 800; letter-spacing: -0.02em; color: #0f172a;">
                                            Airship<span style="color: #ec4899;">Express</span>
                                        </div>
                                        <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-top: 2px;">
                                            Procurement Department
                                        </div>
                                    </td>
                                    <td valign="top" align="right">
                                        <span style="display: inline-block; background-color: #f1f5f9; color: #0f172a; font-family: monospace; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
                                            ${poNumber}
                                        </span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Email Body -->
                    <tr>
                        <td style="padding: 24px 28px;">
                            
                            <!-- Greeting -->
                            <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 14px 0;">
                                Hello ${supplierName},
                            </h2>

                            <!-- Dynamic / Standard Explanation -->
                            ${bodyContentHtml}

                            <!-- Itemized Breakdown Table -->
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; margin-bottom: 20px; border: 1px solid #f1f5f9; border-radius: 8px; overflow: hidden;">
                                <thead>
                                    <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                                        <th align="left" style="padding: 10px 14px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">Item Description</th>
                                        <th align="center" style="padding: 10px 14px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; width: 50px;">Qty</th>
                                        <th align="right" style="padding: 10px 14px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; width: 100px;">Unit Price</th>
                                        <th align="right" style="padding: 10px 14px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; width: 100px;">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemsHtml}
                                    
                                    <!-- Total Summary Row -->
                                    <tr style="background-color: #fafbfc;">
                                        <td colspan="3" align="right" style="padding: 12px 14px; font-size: 13px; font-weight: 700; color: #475569; border-top: 2px solid #e2e8f0;">
                                            Grand Total:
                                        </td>
                                        <td align="right" style="padding: 12px 14px; font-size: 15px; font-weight: 800; color: #ec4899; border-top: 2px solid #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;">
                                            ₱${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>

                            <!-- Metadata Banner -->
                            <div style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; font-size: 12.5px; color: #64748b;">
                                <div style="margin-bottom: ${notes ? '6px' : '0'};">
                                    <strong style="color: #334155;">Expected Delivery:</strong> ${deliveryDate || 'Standard Timeline'}
                                </div>
                                ${notes ? `
                                    <div style="border-top: 1px dashed #e2e8f0; padding-top: 6px;">
                                        <strong style="color: #334155;">Notes / Instructions:</strong> ${notes}
                                    </div>
                                ` : ''}
                            </div>

                            <!-- Primary Action CTA -->
                            <div style="text-align: center; margin: 28px 0 20px;">
                                <a href="${confirmLink}" target="_blank" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 28px; font-size: 13.5px; font-weight: 700; border-radius: 8px; letter-spacing: 0.01em;">
                                    Confirm Purchase Order &rarr;
                                </a>
                                <p style="font-size: 11px; color: #94a3b8; margin: 8px 0 0;">
                                    Click above to confirm availability and acknowledge receipt.
                                </p>
                            </div>

                            <!-- Clean Minimalist Footer Sign-off -->
                            <div style="margin-top: 32px; padding-top: 18px; border-top: 1px solid #f1f5f9; font-size: 12.5px; color: #475569;">
                                <div style="font-weight: 700; color: #0f172a; font-size: 13px;">${senderName}</div>
                                <div style="color: #64748b; font-size: 12px; margin-top: 1px;">${resolvedPosition}</div>
                                ${senderEmail ? `<div style="color: #94a3b8; font-size: 11px; margin-top: 2px;">${senderEmail}</div>` : ''}
                            </div>

                        </td>
                    </tr>

                </table>

                <!-- System Disclaimer -->
                <div style="text-align: center; margin-top: 16px; font-size: 11px; color: #94a3b8;">
                    AirshipExpress Procurement System · Automated Order Notification
                </div>

            </td>
        </tr>
    </table>

</body>
</html>
    `;
}