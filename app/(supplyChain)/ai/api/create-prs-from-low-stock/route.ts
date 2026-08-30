// app/(supplyChain)/ai/api/create-prs-from-low-stock/route.ts

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/(supplyChain)/lib/services/client/supabase";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            items,
            role = "",
            user_name = "AI Assistant",
            user_email = "",
            department = "Warehouse"
        } = body;

        // Authorization check: Strictly Admin, Executive, and Manager only
        const normalizedRole = (role || "").toLowerCase().trim();
        const allowedRoles = ["admin", "executive", "manager"];
        if (!normalizedRole || !allowedRoles.includes(normalizedRole)) {
            return NextResponse.json(
                { success: false, error: "Access denied. Only Admin, Executive, and Manager can create Purchase Requests." },
                { status: 403 }
            );
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json(
                { success: false, error: "No inventory items selected." },
                { status: 400 }
            );
        }

        // Fetch supplier lookup map
        const { data: allSuppliers } = await supabase
            .from("suppliers")
            .select("id, name, email, contact_person");

        const supplierMap = new Map<string, any>();
        if (allSuppliers) {
            allSuppliers.forEach((s: any) => {
                supplierMap.set(String(s.id), s);
                if (s.name) {
                    supplierMap.set(s.name.toLowerCase().trim(), s);
                }
            });
        }

        const createdPRs: any[] = [];
        const notificationRecords: any[] = [];

        for (const item of items) {
            const reqNumber = `PR-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
            const rawSupplier = item.supplier_name || item.supplier || "";
            const matchedSupplier = item.supplier_id
                ? supplierMap.get(String(item.supplier_id))
                : (rawSupplier ? (supplierMap.get(rawSupplier) || supplierMap.get(rawSupplier.toLowerCase().trim())) : null);

            const supplierId = matchedSupplier?.id || item.supplier_id || null;
            const supplierName = matchedSupplier?.name || rawSupplier || "Default Supplier";

            const qty = Math.max(1, Number(item.quantity) || 1);
            const unitPrice = Number(item.unit_price) || Number(item.purchase_price) || 100;
            const totalAmount = qty * unitPrice;
            const today = new Date().toISOString().split("T")[0];

            const lineItem = {
                inventory_item_id: item.inventory_item_id || item.id,
                item_code: item.item_code || `ITEM-${item.id}`,
                item_name: item.item_name || "Inventory Item",
                name: item.item_name || "Inventory Item",
                quantity: qty,
                unit_price: unitPrice,
                total: totalAmount,
                category: item.category || "General",
            };

            const priority = item.stock_type === "out_of_stock" ? "Urgent" : "Normal";

            const prData: Record<string, any> = {
                request_number: reqNumber,
                type: "Stock Replenishment",
                description: `Stock Replenishment: ${item.item_name} (${qty} ${item.unit || "pcs"})`,
                requested_by: user_name || "Inventory Officer",
                department: department,
                supplier_id: supplierId ? String(supplierId) : null,
                supplier_name: supplierName,
                amount: totalAmount,
                priority: priority,
                date: today,
                status: "Pending",
                items: [lineItem],
                reason: item.reason || `AI automated replenishment for ${item.item_name} (${item.stock_type === 'out_of_stock' ? 'Out of Stock' : 'Low Stock'})`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

            const { data: insertedPR, error: insertErr } = await supabase
                .from("purchase_requests")
                .insert([prData])
                .select()
                .single();

            if (insertErr) {
                console.error("Error inserting PR in database:", insertErr, prData);
                throw new Error(`Failed to insert PR for ${item.item_name}: ${insertErr.message}`);
            }

            const savedPR = insertedPR || { ...prData, id: reqNumber };
            createdPRs.push(savedPR);

            // Create notification for Admin & Executive
            const notifTitle = `New Purchase Request: ${reqNumber}`;
            const notifMsg = `Stock replenishment PR for ${item.item_name} (Qty: ${qty}, ₱${totalAmount.toLocaleString()}) created by ${user_name}. Pending review & approval.`;
            const notifLink = `/procurement?search=${encodeURIComponent(reqNumber)}`;

            // Send notification targeted for Admin role
            notificationRecords.push({
                creator_name: user_name || "AI Assistant",
                creator_email: user_email || "system@airshipexpress.ph",
                title: notifTitle,
                message: notifMsg,
                type: "purchase_request",
                link: notifLink,
                role: "Admin",
                is_read: false,
                po_request_id: savedPR.id || reqNumber,
            });

            // Send notification targeted for Executive role
            notificationRecords.push({
                creator_name: user_name || "AI Assistant",
                creator_email: user_email || "system@airshipexpress.ph",
                title: notifTitle,
                message: notifMsg,
                type: "purchase_request",
                link: notifLink,
                role: "Executive",
                is_read: false,
                po_request_id: savedPR.id || reqNumber,
            });
        }

        // Batch insert notifications
        if (notificationRecords.length > 0) {
            const { error: notifErr } = await supabase
                .from("notifications")
                .insert(notificationRecords);

            if (notifErr) {
                console.error("Error inserting notifications for PRs:", notifErr);
            }
        }

        return NextResponse.json({
            success: true,
            message: `Successfully created ${createdPRs.length} Purchase Request(s) and notified Admin and Executive.`,
            createdPRs,
            notificationsCount: notificationRecords.length,
        });

    } catch (err: any) {
        console.error("Error in create-prs-from-low-stock route:", err);
        return NextResponse.json(
            { success: false, error: err.message || "Failed to create purchase requests" },
            { status: 500 }
        );
    }
}
