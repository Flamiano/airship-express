import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/services/client/supabase";

export const PENDING_DOC_NOTIFY_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes (or switch to 5 * 60 * 60 * 1000 for 5 hours)
export const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;

// Server-side cooldown cache: prevents DB thundering herds when hundreds of users are connected
let lastGlobalCheckTime = 0;
const GLOBAL_COOLDOWN_MS = 30 * 1000; // 30 seconds debounce across all concurrent clients

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const { currentUserId, intervalMs = PENDING_DOC_NOTIFY_INTERVAL_MS, force = false } = body;

        const now = Date.now();

        // 1. Throttling check: if another user triggered the check < 30 seconds ago, skip duplicate DB scans
        if (!force && (now - lastGlobalCheckTime) < GLOBAL_COOLDOWN_MS) {
            return NextResponse.json({
                success: true,
                message: "Notification check throttled (recent check still valid).",
                notifiedCount: 0,
                throttled: true,
            });
        }

        lastGlobalCheckTime = now;

        // 2. Fetch pending documents in a single query (indexed, limit 200)
        let docQuery = supabase
            .from("documents")
            .select("id, title, file_name, file_type, storage_path, user_id, uploaded_by, role, created_at")
            .or("file_type.eq.pending,storage_path.eq.,file_size.eq.0")
            .order("created_at", { ascending: false })
            .limit(200);

        if (currentUserId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentUserId)) {
            docQuery = docQuery.eq("user_id", currentUserId);
        }

        const { data: pendingDocs, error: docError } = await docQuery;

        if (docError) {
            console.error("Error querying pending documents:", docError);
            return NextResponse.json({ success: false, error: docError.message }, { status: 500 });
        }

        if (!pendingDocs || pendingDocs.length === 0) {
            return NextResponse.json({
                success: true,
                message: "No pending documents found.",
                notifiedCount: 0,
            });
        }

        const docIds = pendingDocs.map((d) => d.id).filter(Boolean);

        // 3. Batch query existing notifications for all these documents in ONE single query
        const { data: existingNotifs, error: notifFetchError } = await supabase
            .from("notifications")
            .select("reference_id, created_at")
            .in("reference_id", docIds)
            .order("created_at", { ascending: false });

        if (notifFetchError) {
            console.warn("Could not batch-fetch existing notifications:", notifFetchError);
        }

        // 4. Map latest notification timestamp by doc ID in memory (O(1) lookup)
        const latestNotifByDoc = new Map<string, number>();
        if (existingNotifs) {
            for (const notif of existingNotifs) {
                if (notif.reference_id && !latestNotifByDoc.has(notif.reference_id)) {
                    latestNotifByDoc.set(notif.reference_id, new Date(notif.created_at).getTime());
                }
            }
        }

        // 5. Identify documents that need a reminder
        const notificationsToInsert: any[] = [];
        const notifiedDocIds: string[] = [];

        for (const doc of pendingDocs) {
            const createdAtMs = doc.created_at ? new Date(doc.created_at).getTime() : now;
            const docAgeMs = now - createdAtMs;
            const lastNotifTime = latestNotifByDoc.get(doc.id);

            let shouldNotify = false;
            if (lastNotifTime === undefined) {
                // First notification if document was created without file and reached interval
                shouldNotify = docAgeMs >= intervalMs;
            } else {
                // Subsequent notification if interval elapsed since previous alert
                shouldNotify = (now - lastNotifTime) >= intervalMs;
            }

            if (shouldNotify) {
                const notifItem: any = {
                    creator_name: "AI Document Compliance",
                    creator_email: "compliance@airshipexpress.ph",
                    title: `Missing File: "${doc.title}"`,
                    message: `Document "${doc.title}" (Ref: ${doc.id.substring(0, 8)}) was created without an attachment. Please attach the required file.`,
                    type: "alert",
                    link: "/documents",
                    role: doc.role || "All",
                    reference_type: "document_pending",
                    reference_id: doc.id,
                    is_read: false,
                };

                if (doc.user_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(doc.user_id)) {
                    notifItem.user_id = doc.user_id;
                }

                notificationsToInsert.push(notifItem);
                notifiedDocIds.push(doc.id);
            }
        }

        // 6. Bulk insert all notifications in a SINGLE batch operation
        let insertedCount = 0;
        if (notificationsToInsert.length > 0) {
            let { error: batchInsertError } = await supabase
                .from("notifications")
                .insert(notificationsToInsert);

            if (batchInsertError) {
                console.warn("Batch insert with user_id failed, stripping user_id fallback:", batchInsertError.message);
                const sanitized = notificationsToInsert.map(({ user_id, ...rest }) => rest);
                const retryResult = await supabase
                    .from("notifications")
                    .insert(sanitized);
                if (!retryResult.error) {
                    insertedCount = notificationsToInsert.length;
                }
            } else {
                insertedCount = notificationsToInsert.length;
            }
        }

        return NextResponse.json({
            success: true,
            totalPendingDocuments: pendingDocs.length,
            notifiedCount: insertedCount,
            notifiedDocIds,
            intervalMinutes: Math.round(intervalMs / (60 * 1000)),
        });
    } catch (error: any) {
        console.error("Error in pending-notifications route:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to process pending notifications." },
            { status: 500 }
        );
    }
}
