import * as XLSX from 'xlsx';
import { sendSupplyChainEmail, EmailAttachment } from '../email/mailer';

export interface DispatchParcelItem {
    id?: number;
    barcode: string;
    tracking_number?: string;
    destination?: string | null;
    courier?: string | null;
    sender_name?: string | null;
    customer_name?: string | null;
    customer_number?: string | null;
    city?: string | null;
    region?: string | null;
    priority?: string | null;
    bulk_qr_code?: string | null;
    bulk_qr_city?: string | null;
    bulk_qr_courier?: string | null;
    current_parcels_location?: string | null;
    driver_name?: string | null;
    status?: string;
    date_received?: string | null;
    created_at?: string;
    updated_at?: string;
    scanned_by?: string | null;
    [key: string]: any;
}

export interface GenerateManifestOptions {
    driverName: string;
    dispatchDate?: string;
    parcels: DispatchParcelItem[];
    hubName?: string;
}

/**
 * Builds a comprehensive Excel manifest binary buffer containing all parcel columns
 */
export function generateDispatchManifestExcel(options: GenerateManifestOptions): Buffer {
    const { driverName, dispatchDate = new Date().toLocaleString(), parcels, hubName = 'Main Logistics Hub' } = options;

    const rows = [
        ['AIRSHIP EXPRESS LOGISTICS - WAREHOUSE DISPATCH MANIFEST'],
        [`Assigned Driver: ${driverName}`, ``, `Dispatch Date: ${dispatchDate}`, ``, `Origin Hub: ${hubName}`],
        [`Total Dispatched Parcels: ${parcels.length}`, ``, `Report Generated: ${new Date().toISOString()}`],
        [], // empty line
        [
            'No.',
            'Tracking Number',
            'Barcode',
            'Status',
            'Priority',
            'Courier',
            'Sender Name',
            'Recipient / Customer',
            'Customer Contact',
            'Destination Address',
            'City',
            'Region',
            'Current Location',
            'Bulk QR Code',
            'Assigned Driver',
            'Date Received',
            'Dispatch Time'
        ]
    ];

    parcels.forEach((p, index) => {
        rows.push([
            (index + 1).toString(),
            p.tracking_number || p.barcode || 'N/A',
            p.barcode || 'N/A',
            p.status || 'picked_up',
            p.priority || 'Normal',
            p.courier || p.bulk_qr_courier || 'Standard',
            p.sender_name || 'N/A',
            p.customer_name || 'N/A',
            p.customer_number || 'N/A',
            p.destination || 'Unassigned',
            p.city || p.bulk_qr_city || 'N/A',
            p.region || 'N/A',
            p.current_parcels_location || 'Pickup Area',
            [p.bulk_qr_code, p.bulk_qr_city, p.bulk_qr_courier].filter(Boolean).join(', ') || 'N/A',
            p.driver_name || driverName,
            p.date_received || p.created_at || 'N/A',
            dispatchDate
        ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);

    // Set auto/generous column widths for every column
    worksheet['!cols'] = [
        { wch: 6 },  // No.
        { wch: 28 }, // Tracking Number
        { wch: 22 }, // Barcode
        { wch: 14 }, // Status
        { wch: 12 }, // Priority
        { wch: 18 }, // Courier
        { wch: 24 }, // Sender Name
        { wch: 24 }, // Recipient / Customer
        { wch: 18 }, // Customer Contact
        { wch: 34 }, // Destination Address
        { wch: 18 }, // City
        { wch: 18 }, // Region
        { wch: 20 }, // Current Location
        { wch: 30 }, // Bulk QR Code
        { wch: 24 }, // Assigned Driver
        { wch: 24 }, // Date Received
        { wch: 24 }, // Dispatch Time
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Dispatch Manifest');

    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return Buffer.from(excelBuffer);
}

/**
 * Builds HTML Email content for dispatch notification
 */
export function buildDispatchEmailHtml(options: {
    driverName: string;
    parcels: DispatchParcelItem[];
    dispatchDate: string;
    hubName?: string;
}): string {
    const { driverName, parcels, dispatchDate, hubName = 'Main Logistics Hub' } = options;

    const parcelRows = parcels.slice(0, 15).map((p, idx) => `
        <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 0 ? 'background-color: #f8fafc;' : ''}">
            <td style="padding: 10px 12px; font-size: 13px; color: #475569;">${idx + 1}</td>
            <td style="padding: 10px 12px; font-size: 13px; font-weight: 600; color: #0f172a; font-family: monospace;">${p.tracking_number || p.barcode}</td>
            <td style="padding: 10px 12px; font-size: 13px; color: #334155;">${p.customer_name || 'N/A'}</td>
            <td style="padding: 10px 12px; font-size: 13px; color: #334155;">${p.destination || 'Unassigned'}</td>
            <td style="padding: 10px 12px; font-size: 13px; color: #334155;">${p.courier || 'Standard'}</td>
        </tr>
    `).join('');

    const moreRowsNote = parcels.length > 15
        ? `<p style="font-size: 13px; color: #64748b; font-style: italic; margin-top: 8px;">+ ${parcels.length - 15} more parcels listed in the attached Excel manifest.</p>`
        : '';

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #1e293b; background-color: #f1f5f9; margin: 0; padding: 20px; }
            .container { max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
            .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; padding: 28px 24px; text-align: left; }
            .badge { display: inline-block; background: #0284c7; color: #ffffff; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
            .title { margin: 0; font-size: 22px; font-weight: 700; color: #ffffff; }
            .subtitle { margin: 6px 0 0; font-size: 14px; color: #94a3b8; }
            .body-content { padding: 24px; }
            .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px; display: table; width: 100%; box-sizing: border-box; }
            .summary-col { display: table-cell; width: 50%; vertical-align: top; }
            .label { font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-bottom: 4px; }
            .value { font-size: 15px; color: #0f172a; font-weight: 600; }
            .table-container { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-top: 16px; }
            table { width: 100%; border-collapse: collapse; text-align: left; }
            th { background: #f1f5f9; padding: 10px 12px; font-size: 12px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #cbd5e1; }
            .attachment-banner { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 14px 16px; margin-top: 20px; display: flex; align-items: center; }
            .footer { background: #f8fafc; padding: 16px 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="badge">Dispatch Notification</div>
                <h1 class="title">Warehouse Dispatch Manifest</h1>
                <p class="subtitle">Airship Express Supply Chain & Warehousing</p>
            </div>
            
            <div class="body-content">
                <p style="font-size: 15px; margin-top: 0;">
                    Hello, a new batch of <strong>${parcels.length} parcel(s)</strong> has been dispatched and assigned to Driver <strong>${driverName}</strong>.
                </p>

                <div class="summary-card">
                    <div class="summary-col">
                        <div class="label">Assigned Driver</div>
                        <div class="value">${driverName}</div>
                        <div style="height: 12px;"></div>
                        <div class="label">Total Parcels</div>
                        <div class="value" style="color: #0284c7; font-size: 18px;">${parcels.length} Items</div>
                    </div>
                    <div class="summary-col">
                        <div class="label">Dispatch Date & Time</div>
                        <div class="value">${dispatchDate}</div>
                        <div style="height: 12px;"></div>
                        <div class="label">Origin Facility</div>
                        <div class="value">${hubName}</div>
                    </div>
                </div>

                <div style="margin-top: 20px;">
                    <h3 style="font-size: 15px; font-weight: 600; margin: 0 0 8px; color: #0f172a;">Parcel Manifest Preview</h3>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Tracking / Barcode</th>
                                    <th>Destination</th>
                                    <th>Courier</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${parcelRows}
                            </tbody>
                        </table>
                    </div>
                    ${moreRowsNote}
                </div>

                <div class="attachment-banner">
                    <div>
                        <strong style="color: #065f46; font-size: 14px;">📎 Excel Manifest Attached</strong>
                        <p style="margin: 3px 0 0; color: #047857; font-size: 13px;">
                            The full dispatch spreadsheet (<strong>dispatch_manifest_${driverName.replace(/\s+/g, '_')}.xlsx</strong>) is attached to this email for record-keeping and route execution.
                        </p>
                    </div>
                </div>
            </div>

            <div class="footer">
                <p style="margin: 0;">This is an automated operational notification from Airship Express Supply Chain System.</p>
                <p style="margin: 4px 0 0;">&copy; ${new Date().getFullYear()} Airship Express. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    `;
}

/**
 * Generates Excel manifest and dispatches email via Brevo to Driver and Supervisors
 */
export async function sendDispatchManifestEmail(options: {
    driverName: string;
    driverEmail?: string;
    supervisorEmails?: string[];
    parcels: DispatchParcelItem[];
    hubName?: string;
}) {
    const { driverName, driverEmail, supervisorEmails = [], parcels, hubName } = options;

    const dispatchDate = new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Manila',
        dateStyle: 'medium',
        timeStyle: 'short'
    });

    // 1. Generate Excel buffer
    const excelBuffer = generateDispatchManifestExcel({
        driverName,
        dispatchDate,
        parcels,
        hubName
    });

    const safeDriverFilename = driverName.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `dispatch_manifest_${safeDriverFilename}_${Date.now()}.xlsx`;
    const base64Content = excelBuffer.toString('base64');

    const attachment: EmailAttachment = {
        name: filename,
        content: base64Content,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };

    // 2. Build HTML Body
    const html = buildDispatchEmailHtml({
        driverName,
        parcels,
        dispatchDate,
        hubName
    });

    // 3. Build recipient list (ONLY the driver receives the email with Excel attachment)
    const recipients: { email: string; name?: string }[] = [];

    if (driverEmail && driverEmail.includes('@')) {
        recipients.push({ email: driverEmail.trim(), name: driverName });
    }

    if (recipients.length === 0) {
        // No driver email resolved - do not email supervisors (Admin/Exec/Manager view via in-app notification)
        return {
            success: true,
            messageId: null,
            provider: 'skipped (no driver email)',
            filename,
            base64: base64Content,
            recipients: []
        };
    }

    const subject = `[Dispatch Manifest] ${driverName} - ${parcels.length} Parcel(s) (${dispatchDate})`;

    const result = await sendSupplyChainEmail({
        to: recipients,
        subject,
        html,
        text: `Dispatch Manifest for Driver: ${driverName}. Total parcels: ${parcels.length}. Please view the attached Excel sheet.`,
        senderName: 'Airship Express Dispatch',
        attachments: [attachment]
    });

    return {
        success: result.success,
        messageId: result.messageId,
        provider: result.provider,
        filename,
        base64: base64Content,
        recipients: recipients.map(r => r.email)
    };
}
