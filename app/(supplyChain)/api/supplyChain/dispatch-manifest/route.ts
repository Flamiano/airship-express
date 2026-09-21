import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/services/client/supabase';
import { sendDispatchManifestEmail, DispatchParcelItem } from '../../../lib/utils/dispatchManifest';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { driverName, parcelIds, parcels: providedParcels } = body;

        if (!driverName) {
            return NextResponse.json(
                { success: false, error: 'Driver name is required' },
                { status: 400 }
            );
        }

        let dispatchParcels: DispatchParcelItem[] = [];

        const targetIds: (string | number)[] = [];
        if (Array.isArray(parcelIds) && parcelIds.length > 0) {
            targetIds.push(...parcelIds);
        } else if (Array.isArray(providedParcels) && providedParcels.length > 0) {
            targetIds.push(...providedParcels.map(p => p.id).filter(Boolean));
        }

        if (targetIds.length > 0) {
            const { data, error } = await supabase
                .from('parcels')
                .select('*')
                .in('id', targetIds);

            if (!error && data && data.length > 0) {
                dispatchParcels = data;
            }
        }

        if (dispatchParcels.length === 0 && Array.isArray(providedParcels) && providedParcels.length > 0) {
            dispatchParcels = providedParcels;
        }

        if (dispatchParcels.length === 0) {
            return NextResponse.json(
                { success: false, error: 'No parcel data found to generate dispatch manifest' },
                { status: 400 }
            );
        }

        // 1. Resolve Driver Email from request body, mock_employees, or users
        let driverEmail: string | undefined = body.driverEmail;

        if (!driverEmail || !driverEmail.includes('@')) {
            try {
                const normalizeTokens = (nameStr: string) =>
                    (nameStr || '')
                        .toLowerCase()
                        .replace(/[^a-z0-9]/g, ' ')
                        .split(/\s+/)
                        .filter(Boolean);

                const driverTokens = normalizeTokens(driverName);

                const isNameMatch = (targetName: string) => {
                    const targetTokens = normalizeTokens(targetName);
                    if (targetTokens.length === 0 || driverTokens.length === 0) return false;
                    return driverTokens.every(t => targetTokens.includes(t)) ||
                        targetTokens.every(t => driverTokens.includes(t));
                };

                const { data: empData, error: empErr } = await supabase
                    .from('mock_employees')
                    .select('id, display_name, email, position, role');

                if (empData && !empErr) {
                    const matched = empData.find(e => isNameMatch(e.display_name || ''));
                    if (matched && matched.email) {
                        driverEmail = matched.email;
                    }
                }

                if (!driverEmail) {
                    const { data: userData, error: userErr } = await supabase
                        .from('users')
                        .select('id, display_name, email, role');

                    if (userData && !userErr) {
                        const matchedUser = userData.find(u => isNameMatch(u.display_name || ''));
                        if (matchedUser && matchedUser.email) {
                            driverEmail = matchedUser.email;
                        }
                    }
                }
            } catch (driverLookupErr) {
                console.warn('Could not resolve driver email:', driverLookupErr);
            }
        }

        // 2. Send Email ONLY to Driver with Brevo (Supervisors will download via in-app notification)
        const result = await sendDispatchManifestEmail({
            driverName,
            driverEmail,
            parcels: dispatchParcels
        });

        // 3. Generate direct download URL for Admin, Manager, and Executive in-app notifications
        const idsList = dispatchParcels.map(p => p.id).filter(Boolean).join(',');
        const downloadUrl = `/api/supplyChain/dispatch-manifest/download?driver=${encodeURIComponent(driverName)}&ids=${encodeURIComponent(idsList)}&filename=${encodeURIComponent(result.filename)}`;

        // 4. Insert notification for Admin, Manager, and Executive into notifications table with attached download link
        let notificationResult: any = null;
        try {
            const { dispatcherName, dispatcherEmail } = body;
            const count = dispatchParcels.length;
            const trackingSummary = count === 1
                ? (dispatchParcels[0]?.tracking_number || dispatchParcels[0]?.barcode || `Parcel #${dispatchParcels[0]?.id}`)
                : `${count} parcels`;

            const notifTitle = count === 1
                ? `Parcel Dispatched: ${driverName}`
                : `Parcels Dispatched: ${driverName} (${count})`;

            const notifMsg = `${count} parcel(s) [${trackingSummary}] dispatched to driver ${driverName} by ${dispatcherName || 'Warehouse Staff'}. Click below to download the attached Excel manifest.`;

            const { data: notifData, error: notifErr } = await supabase
                .from('notifications')
                .insert({
                    creator_name: dispatcherName || 'Warehouse Dispatch',
                    creator_email: dispatcherEmail || 'supplychain.airshipexpress@gmail.com',
                    title: notifTitle,
                    message: notifMsg,
                    type: 'dispatch_manifest',
                    link: downloadUrl,
                    role: 'All',
                    is_read: false
                })
                .select()
                .single();

            if (notifErr) {
                console.error('Error inserting dispatch notification into notifications table:', notifErr);
            } else {
                notificationResult = notifData;
            }
        } catch (notifErr) {
            console.error('Failed to create dispatch notification:', notifErr);
        }

        return NextResponse.json({
            success: true,
            message: `Dispatch manifest processed for ${dispatchParcels.length} parcel(s)`,
            provider: result.provider,
            driverEmail: driverEmail || null,
            downloadUrl,
            filename: result.filename,
            base64: result.base64,
            recipients: result.recipients,
            notification: notificationResult
        });

    } catch (error: any) {
        console.error('Error dispatching manifest email:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to dispatch manifest email' },
            { status: 500 }
        );
    }
}
