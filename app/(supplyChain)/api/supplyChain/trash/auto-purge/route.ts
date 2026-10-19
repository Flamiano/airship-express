import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_URL || '';
const serviceRoleKey = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_ANON_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

// 24-hour in-memory throttle: prevents repeated database calls
let lastPurgeTimestamp = 0;
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const RETENTION_DAYS = 10;

export async function GET() {
    const now = Date.now();
    const isEligible = (now - lastPurgeTimestamp) >= COOLDOWN_MS;
    return NextResponse.json({
        ok: true,
        retentionDays: RETENTION_DAYS,
        lastPurgedAt: lastPurgeTimestamp ? new Date(lastPurgeTimestamp).toISOString() : null,
        nextEligibleAt: lastPurgeTimestamp ? new Date(lastPurgeTimestamp + COOLDOWN_MS).toISOString() : 'now',
        isEligible,
    });
}

export async function POST(request: Request) {
    const now = Date.now();

    let isForced = false;
    try {
        const body = await request.json().catch(() => ({}));
        isForced = Boolean(body?.force);
    } catch {
        // ignore JSON parse error on empty body
    }

    // 24-Hour Cooldown Guard: return in 0ms without querying Supabase
    if (!isForced && (now - lastPurgeTimestamp) < COOLDOWN_MS) {
        return NextResponse.json({
            ok: true,
            purged: false,
            message: 'Purge skipped: 24-hour cooldown active',
            nextEligibleAt: new Date(lastPurgeTimestamp + COOLDOWN_MS).toISOString(),
        });
    }

    // Lock immediately to prevent concurrent duplicate executions
    lastPurgeTimestamp = now;

    try {
        const cutoffDate = new Date(now - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

        // 1. Purge expired records from documents_archive
        const { data: expiredDocs, error: findDocsError } = await supabaseAdmin
            .from('documents_archive')
            .select('id, storage_path')
            .lt('deleted_at', cutoffDate);

        let purgedDocsCount = 0;
        if (!findDocsError && expiredDocs && expiredDocs.length > 0) {
            // Clean up files in Supabase Storage
            const storagePaths = expiredDocs
                .map(d => d.storage_path)
                .filter((p): p is string => Boolean(p));

            if (storagePaths.length > 0) {
                try {
                    await supabaseAdmin.storage
                        .from('documents')
                        .remove(storagePaths);
                } catch (storageErr) {
                    console.error('[Auto-Purge] Error cleaning up storage files:', storageErr);
                }
            }

            // Permanently delete archived rows
            const { error: deleteDocsError, count } = await supabaseAdmin
                .from('documents_archive')
                .delete({ count: 'exact' })
                .lt('deleted_at', cutoffDate);

            if (!deleteDocsError) {
                purgedDocsCount = count ?? expiredDocs.length;
            }
        }

        // 2. Purge expired records from purchase_orders_archive
        const { error: deletePosError, count: posCount } = await supabaseAdmin
            .from('purchase_orders_archive')
            .delete({ count: 'exact' })
            .lt('deleted_at', cutoffDate);

        const purgedPosCount = (!deletePosError && posCount) ? posCount : 0;

        return NextResponse.json({
            ok: true,
            purged: true,
            cutoffDate,
            purgedCounts: {
                documents: purgedDocsCount,
                purchaseOrders: purgedPosCount,
            },
            message: `Successfully purged archived items older than ${RETENTION_DAYS} days.`,
        });
    } catch (error: any) {
        console.error('[Auto-Purge] Error running trash retention purge:', error);
        return NextResponse.json({
            ok: false,
            error: error?.message || 'Failed to auto-purge trash',
        }, { status: 500 });
    }
}
