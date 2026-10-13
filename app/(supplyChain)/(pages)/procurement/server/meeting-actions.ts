// app/(supplyChain)/(pages)/procurement/server/meeting-actions.ts
'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { sendSupplyChainEmail } from '../../../lib/email/mailer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_URL || '';
const serviceRoleKey = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_ANON_KEY || '';

const dbClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

export interface ScheduleMeetingPayload {
    meetingId?: string;
    supplierId?: number | string | null;
    supplierName: string;
    supplierEmail: string;
    contactPerson?: string;
    contactPhone?: string;
    title: string;
    meetingType: 'Video Conference' | 'On-Site / In-Person' | 'Phone Call';
    meetingDate: string; // YYYY-MM-DD
    startTime: string;   // e.g. "10:00 AM" or "14:00"
    endTime?: string;
    duration?: string;   // e.g. "45 mins"
    timezone?: string;
    meetingLink?: string;
    location?: string;
    agenda: string;
    internalNotes?: string;
    requisitionId?: string;
    requestNumber?: string;
    itemName?: string;
    quotationId?: number | string | null;
    organizerId?: string | null;
    organizerName: string;
    organizerEmail: string;
}

export interface SupplierMeetingRecord {
    id: string;
    supplier_id?: number | null;
    supplier_name: string;
    supplier_email: string;
    contact_person?: string | null;
    contact_phone?: string | null;
    title: string;
    meeting_type: string;
    meeting_date: string;
    start_time: string;
    end_time?: string | null;
    duration?: string | null;
    timezone?: string | null;
    meeting_link?: string | null;
    location?: string | null;
    agenda: string;
    internal_notes?: string | null;
    requisition_id?: string | null;
    request_number?: string | null;
    item_name?: string | null;
    quotation_id?: number | null;
    organizer_id?: string | null;
    organizer_name: string;
    organizer_email: string;
    status: 'Scheduled' | 'Completed' | 'Rescheduled' | 'Cancelled';
    cancellation_reason?: string | null;
    email_sent: boolean;
    portal_notified: boolean;
    created_at: string;
    updated_at: string;
}

/**
 * 1. Schedule a meeting with supplier, persist to supplier_meetings, 
 *    send an invitation email, and notify in the Supplier Portal (messages).
 */
export async function scheduleSupplierMeetingAction(payload: ScheduleMeetingPayload) {
    try {
        if (!payload.supplierEmail || !payload.supplierEmail.trim()) {
            return { success: false, error: 'Supplier email address is required.' };
        }
        if (!payload.meetingDate || !payload.startTime) {
            return { success: false, error: 'Meeting date and time are required.' };
        }
        if (!payload.title || !payload.title.trim()) {
            return { success: false, error: 'Meeting title is required.' };
        }
        if (!payload.agenda || !payload.agenda.trim()) {
            return { success: false, error: 'Meeting agenda / objective is required.' };
        }

        const now = new Date().toISOString();
        const supplierEmailClean = payload.supplierEmail.trim().toLowerCase();
        const isUpdate = Boolean(payload.meetingId);

        // 1. Resolve Supplier ID if not provided
        let resolvedSupplierId: number | null = payload.supplierId ? Number(payload.supplierId) : null;
        if (!resolvedSupplierId) {
            try {
                // Try finding by email in suppliers table
                const { data: supData } = await dbClient
                    .from('suppliers')
                    .select('id, name')
                    .or(`email.ilike.${supplierEmailClean},contact_email.ilike.${supplierEmailClean}`)
                    .limit(1)
                    .maybeSingle();

                if (supData?.id) {
                    resolvedSupplierId = Number(supData.id);
                } else {
                    // Try finding by name
                    const { data: nameMatch } = await dbClient
                        .from('suppliers')
                        .select('id')
                        .ilike('name', `%${payload.supplierName.trim()}%`)
                        .limit(1)
                        .maybeSingle();

                    if (nameMatch?.id) {
                        resolvedSupplierId = Number(nameMatch.id);
                    } else {
                        // Check suppliers_account table
                        const { data: accData } = await dbClient
                            .from('suppliers_account')
                            .select('supplier_id')
                            .ilike('email', supplierEmailClean)
                            .limit(1)
                            .maybeSingle();
                        if (accData?.supplier_id) {
                            resolvedSupplierId = Number(accData.supplier_id);
                        }
                    }
                }
            } catch (err) {
                console.warn('Supplier ID resolution notice:', err);
            }
        }

        // 2. Insert record into public.supplier_meetings
        let insertedMeeting: any = null;
        let dbInsertSuccess = false;
        try {
            const meetingInsertPayload = {
                supplier_id: resolvedSupplierId,
                supplier_name: payload.supplierName,
                supplier_email: supplierEmailClean,
                contact_person: payload.contactPerson || null,
                contact_phone: payload.contactPhone || null,
                title: payload.title.trim(),
                meeting_type: payload.meetingType || 'Video Conference',
                meeting_date: payload.meetingDate,
                start_time: payload.startTime,
                end_time: payload.endTime || null,
                duration: payload.duration || '45 mins',
                timezone: payload.timezone || 'Asia/Manila (GMT+8)',
                meeting_link: payload.meetingLink?.trim() || null,
                location: payload.location?.trim() || null,
                agenda: payload.agenda.trim(),
                internal_notes: payload.internalNotes?.trim() || null,
                requisition_id: payload.requisitionId || null,
                request_number: payload.requestNumber || null,
                item_name: payload.itemName || null,
                quotation_id: payload.quotationId ? Number(payload.quotationId) : null,
                organizer_id: payload.organizerId || null,
                organizer_name: payload.organizerName || 'Procurement Team',
                organizer_email: payload.organizerEmail || 'procurement@airship-express.com',
                status: 'Scheduled',
                email_sent: false,
                portal_notified: false,
                created_at: now,
                updated_at: now,
            };

            if (payload.meetingId) {
                const { data: uData, error: uErr } = await dbClient
                    .from('supplier_meetings')
                    .update({
                        supplier_id: resolvedSupplierId,
                        supplier_name: payload.supplierName,
                        supplier_email: supplierEmailClean,
                        contact_person: payload.contactPerson || null,
                        contact_phone: payload.contactPhone || null,
                        title: payload.title.trim(),
                        meeting_type: payload.meetingType || 'Video Conference',
                        meeting_date: payload.meetingDate,
                        start_time: payload.startTime,
                        end_time: payload.endTime || null,
                        duration: payload.duration || '45 mins',
                        timezone: payload.timezone || 'Asia/Manila (GMT+8)',
                        meeting_link: payload.meetingLink?.trim() || null,
                        location: payload.location?.trim() || null,
                        agenda: payload.agenda.trim(),
                        internal_notes: payload.internalNotes?.trim() || null,
                        status: 'Scheduled',
                        updated_at: now,
                    })
                    .eq('id', payload.meetingId)
                    .select('*')
                    .single();

                if (!uErr && uData) {
                    insertedMeeting = uData;
                    dbInsertSuccess = true;
                } else if (uErr) {
                    console.warn('supplier_meetings update error:', uErr.message);
                }
            } else {
                const { data: mData, error: mErr } = await dbClient
                    .from('supplier_meetings')
                    .insert([meetingInsertPayload])
                    .select('*')
                    .single();

                if (!mErr && mData) {
                    insertedMeeting = mData;
                    dbInsertSuccess = true;
                } else if (mErr) {
                    console.warn('supplier_meetings insert error (table may need schema run):', mErr.message);
                }
            }
        } catch (dbErr) {
            console.warn('supplier_meetings unexpected database error:', dbErr);
        }

        // 3. Send Official Meeting Invitation Email to Supplier
        let emailSuccess = false;
        try {
            const formattedDate = new Date(payload.meetingDate).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });

            const emailSubject = isUpdate
                ? `🔄 Updated Meeting Schedule: ${payload.title} - Airship Express Procurement`
                : `📅 Meeting Invitation: ${payload.title} - Airship Express Procurement`;

            const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${isUpdate ? "Meeting Schedule Update" : "Meeting Invitation"}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
    <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05);">
        <!-- Header -->
        <div style="background-color: #db2777; padding: 32px 28px; text-align: left; color: #ffffff;">
            <div style="display: inline-block; padding: 6px 14px; border-radius: 9999px; background: rgba(255,255,255,0.2); font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px;">
                Airship Express Supply Chain & Procurement
            </div>
            <h1 style="margin: 0; font-size: 22px; font-weight: 900; line-height: 1.3; color: #ffffff;">
                ${isUpdate ? "Official Vendor Meeting Schedule Update" : "Official Vendor Meeting Invitation"}
            </h1>
            <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.9;">
                ${isUpdate ? "Your scheduled meeting details have been updated" : "Sourcing & Quotation Negotiation Session"}
            </p>
        </div>

        <!-- Body -->
        <div style="padding: 28px 24px;">
            <p style="font-size: 14px; line-height: 1.6; margin-top: 0; color: #334155;">
                Dear <strong>${payload.contactPerson || payload.supplierName}</strong>,
            </p>
            <p style="font-size: 14px; line-height: 1.6; color: #334155;">
                ${isUpdate
                    ? `Please be advised that the Airship Express Procurement Team has <strong>updated the scheduled meeting details</strong> regarding <strong>${payload.title}</strong>${payload.itemName ? ` for <strong>${payload.itemName}</strong>` : ""}. Please review your updated meeting schedule, virtual link, and agenda below:`
                    : `The Airship Express Procurement Team invites you to a scheduled session regarding <strong>${payload.title}</strong>${payload.itemName ? ` for <strong>${payload.itemName}</strong>` : ""}.`}
            </p>

            <!-- Meeting Details Card -->
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; margin: 24px 0;">
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <tr>
                        <td style="padding: 8px 0; color: #64748b; font-weight: 600; width: 140px;">Meeting Title:</td>
                        <td style="padding: 8px 0; color: #0f172a; font-weight: 700;">${payload.title}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Date:</td>
                        <td style="padding: 8px 0; color: #0f172a; font-weight: 700;">${formattedDate}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Time:</td>
                        <td style="padding: 8px 0; color: #0f172a; font-weight: 700;">${payload.startTime} ${payload.duration ? `(${payload.duration})` : ''} [${payload.timezone || 'GMT+8'}]</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Meeting Type:</td>
                        <td style="padding: 8px 0; color: #ec4899; font-weight: 800;">${payload.meetingType}</td>
                    </tr>
                    ${payload.meetingLink ? `
                    <tr>
                        <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Virtual Link:</td>
                        <td style="padding: 8px 0;">
                            <a href="${payload.meetingLink}" style="color: #2563eb; font-weight: 700; word-break: break-all; text-decoration: underline;" target="_blank">
                                ${payload.meetingLink}
                            </a>
                        </td>
                    </tr>
                    ` : ''}
                    ${payload.location ? `
                    <tr>
                        <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Location:</td>
                        <td style="padding: 8px 0; color: #0f172a; font-weight: 700;">${payload.location}</td>
                    </tr>
                    ` : ''}
                    ${payload.requestNumber ? `
                    <tr>
                        <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Requisition Ref:</td>
                        <td style="padding: 8px 0; color: #0f172a; font-family: monospace; font-weight: 700;">${payload.requestNumber}</td>
                    </tr>
                    ` : ''}
                </table>
            </div>

            ${payload.meetingLink ? `
            <!-- Action Button -->
            <div style="text-align: center; margin: 28px 0;">
                <a href="${payload.meetingLink}" style="display: inline-block; background-color: #ec4899; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 9999px; font-size: 14px; font-weight: 800; letter-spacing: 0.02em; box-shadow: 0 4px 14px rgba(236,72,153,0.4);" target="_blank">
                    📹 Join Video Meeting
                </a>
            </div>
            ` : ''}

            <!-- Agenda Block -->
            <div style="margin: 24px 0;">
                <h3 style="font-size: 13px; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.05em; margin: 0 0 10px;">
                    Discussion Agenda & Objectives:
                </h3>
                <div style="background-color: #f1f5f9; border-left: 4px solid #ec4899; border-radius: 0 12px 12px 0; padding: 14px 16px; font-size: 13px; line-height: 1.6; color: #334155; white-space: pre-wrap;">
${payload.agenda}
                </div>
            </div>

            <!-- Organizer Info -->
            <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.5;">
                <p style="margin: 0;"><strong>Organizer:</strong> ${payload.organizerName} (${payload.organizerEmail})</p>
                <p style="margin: 4px 0 0;">Airship Express Supply Chain Management Division</p>
                <p style="margin: 4px 0 0;">This invitation is also synchronized with your authorized <a href="https://sc.airship-express.com/suppliers_page" style="color: #ec4899; font-weight: 700;">Supplier Portal</a> account.</p>
            </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #f8fafc; padding: 16px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
            © ${new Date().getFullYear()} Airship Express Logistics Corp. All rights reserved. Confidential Business Communication.
        </div>
    </div>
</body>
</html>
            `;

            const emailResult = await sendSupplyChainEmail({
                to: {
                    email: supplierEmailClean,
                    name: payload.contactPerson || payload.supplierName,
                },
                subject: emailSubject,
                html: emailHtml,
                senderName: payload.organizerName || 'Airship Express Procurement',
                senderEmail: payload.organizerEmail || 'procurement@airship-express.com',
                replyTo: payload.organizerEmail || undefined,
            });

            emailSuccess = Boolean(emailResult.success);
        } catch (emailErr: any) {
            console.warn('Meeting email delivery notice:', emailErr.message);
        }

        // 4. Notify Supplier Portal via messages and notifications tables
        let portalNotified = false;

        // 4a. Post direct message in messages table if supplier ID is resolved
        if (resolvedSupplierId) {
            try {
                const portalMessageBody = isUpdate
                    ? `🔄 MEETING SCHEDULE UPDATED: "${payload.title}"

Hello ${payload.supplierName}, our Procurement Team has updated the details for your scheduled meeting.

• Updated Date: ${payload.meetingDate}
• Updated Time: ${payload.startTime} ${payload.duration ? `(${payload.duration})` : ''} [${payload.timezone || 'GMT+8'}]
• Meeting Type: ${payload.meetingType}
${payload.meetingLink ? `• Video Call Link: ${payload.meetingLink}\n` : ''}${payload.location ? `• Location: ${payload.location}\n` : ''}${payload.requestNumber ? `• Requisition Reference: ${payload.requestNumber}\n` : ''}
Updated Agenda:
${payload.agenda}

Organizer: ${payload.organizerName} (${payload.organizerEmail})`
                    : `📅 MEETING INVITATION: "${payload.title}"

Hello ${payload.supplierName}, our Procurement Team has scheduled a meeting with your representative.

• Date: ${payload.meetingDate}
• Time: ${payload.startTime} ${payload.duration ? `(${payload.duration})` : ''} [${payload.timezone || 'GMT+8'}]
• Meeting Type: ${payload.meetingType}
${payload.meetingLink ? `• Video Call Link: ${payload.meetingLink}\n` : ''}${payload.location ? `• Location: ${payload.location}\n` : ''}${payload.requestNumber ? `• Requisition Reference: ${payload.requestNumber}\n` : ''}
Agenda:
${payload.agenda}

Organizer: ${payload.organizerName} (${payload.organizerEmail})`;

                const { error: msgErr } = await dbClient.from('messages').insert([
                    {
                        supplier_id: resolvedSupplierId,
                        sender_type: 'internal',
                        sender_name: payload.organizerName || 'Procurement Team',
                        sender_email: payload.organizerEmail || 'procurement@airship-express.com',
                        sender_role: 'Procurement Specialist',
                        message: portalMessageBody,
                        attachments: payload.meetingLink ? [payload.meetingLink] : [],
                        is_read: false,
                        created_at: now,
                    },
                ]);

                if (!msgErr) {
                    portalNotified = true;
                } else {
                    console.warn('Supplier portal messages notification notice:', msgErr.message);
                }
            } catch (portalErr) {
                console.warn('Supplier portal message insert error:', portalErr);
            }
        }

        // 4b. Insert broadcast notification for Portal Alerts (accessible to Supplier & Admin)
        try {
            const { error: notifErr } = await dbClient.from('notifications').insert([
                {
                    title: isUpdate ? `Meeting Updated: ${payload.title}` : `Meeting Scheduled: ${payload.title}`,
                    message: isUpdate
                        ? `Procurement updated meeting with ${payload.supplierName} for ${payload.meetingDate} at ${payload.startTime}.`
                        : `Procurement scheduled meeting with ${payload.supplierName} on ${payload.meetingDate} at ${payload.startTime}.`,
                    type: 'meeting',
                    link: '/suppliers_page/meetings',
                    role: ['Supplier', 'Admin'],
                    is_read: false,
                    created_at: now,
                }
            ]);
            if (!notifErr) {
                portalNotified = true;
            }
        } catch (notifErr) {
            console.warn('Meeting notifications table insert notice:', notifErr);
        }

        // 5. Update delivery flags on supplier_meetings
        if (insertedMeeting?.id && (emailSuccess || portalNotified)) {
            try {
                await dbClient
                    .from('supplier_meetings')
                    .update({
                        email_sent: emailSuccess,
                        portal_notified: portalNotified,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', insertedMeeting.id);
            } catch (flagErr) {
                console.warn('Meeting flag update notice:', flagErr);
            }
        }

        // Revalidate relevant pages
        revalidatePath('/procurement');
        revalidatePath('/suppliers_page/meetings');
        revalidatePath('/suppliers_page/messages');

        return {
            success: true,
            meetingId: insertedMeeting?.id || null,
            emailSent: emailSuccess,
            portalNotified: portalNotified,
            message: `Meeting successfully ${isUpdate ? 'updated' : 'scheduled'} with ${payload.supplierName}! ${emailSuccess ? (isUpdate ? 'Updated schedule sent to email.' : 'Invitation sent to email.') : ''} ${portalNotified ? 'Notification posted to Supplier Portal.' : ''}`.trim(),
        };
    } catch (err: any) {
        console.error('Critical failure in scheduleSupplierMeetingAction:', err);
        return {
            success: false,
            error: err.message || 'Failed to schedule meeting with supplier.',
        };
    }
}

/**
 * 2. Fetch Supplier Meetings (for procurement page or supplier portal)
 */
export async function fetchSupplierMeetingsAction(supplierIdOrEmail?: string) {
    try {
        let query = dbClient
            .from('supplier_meetings')
            .select('*')
            .order('meeting_date', { ascending: false })
            .order('start_time', { ascending: true });

        if (supplierIdOrEmail) {
            const val = supplierIdOrEmail.trim().toLowerCase();
            const num = Number(val);
            if (!isNaN(num) && num > 0) {
                query = query.or(`supplier_id.eq.${num},supplier_email.ilike.${val}`);
            } else {
                query = query.ilike('supplier_email', val);
            }
        }

        const { data, error } = await query;
        if (error) {
            console.warn('fetchSupplierMeetingsAction error:', error.message);
            return { success: false, data: [] as SupplierMeetingRecord[], error: error.message };
        }

        return { success: true, data: (data || []) as SupplierMeetingRecord[] };
    } catch (err: any) {
        console.error('fetchSupplierMeetingsAction unexpected error:', err);
        return { success: false, data: [] as SupplierMeetingRecord[], error: err.message };
    }
}

/**
 * 3. Update meeting status (e.g. Completed, Rescheduled, Cancelled)
 */
export async function updateSupplierMeetingStatusAction(
    meetingId: string,
    status: 'Scheduled' | 'Completed' | 'Rescheduled' | 'Cancelled',
    reason?: string
) {
    try {
        const updatePayload: any = {
            status,
            updated_at: new Date().toISOString(),
        };
        if (reason) {
            updatePayload.cancellation_reason = reason;
        }

        const { data, error } = await dbClient
            .from('supplier_meetings')
            .update(updatePayload)
            .eq('id', meetingId)
            .select()
            .single();

        if (error) {
            return { success: false, error: error.message };
        }

        revalidatePath('/procurement');
        revalidatePath('/suppliers_page/meetings');

        return { success: true, data };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

/**
 * 4. Remove / Cancel Supplier Meeting
 */
export async function removeSupplierMeetingAction(meetingId: string) {
    try {
        const { error: delErr } = await dbClient
            .from('supplier_meetings')
            .delete()
            .eq('id', meetingId);

        if (delErr) {
            console.warn('Meeting delete notice, updating status to Cancelled:', delErr.message);
            await dbClient
                .from('supplier_meetings')
                .update({
                    status: 'Cancelled',
                    cancellation_reason: 'Removed by procurement officer',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', meetingId);
        }

        revalidatePath('/procurement');
        revalidatePath('/suppliers_page/meetings');

        return { success: true, message: 'Meeting has been removed.' };
    } catch (err: any) {
        console.error('removeSupplierMeetingAction error:', err);
        return { success: false, error: err.message || 'Failed to remove meeting.' };
    }
}

