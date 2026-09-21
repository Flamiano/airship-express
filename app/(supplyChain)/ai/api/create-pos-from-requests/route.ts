// app/(supplyChain)/ai/api/create-pos-from-requests/route.ts

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../lib/services/client/supabase";
import { buildEmailTemplate } from "../../../(pages)/procurement/api/send-email/template";
import { sendSupplyChainEmail } from "../../../lib/email/mailer";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { request_ids, action = "create_draft", send_email = false, role = "User", user_name = "AI Assistant" } = body;

        // Authorization check: Only Manager, Admin, Executive can generate POs
        const normalizedRole = (role || "").toLowerCase().trim();
        const allowedRoles = ["manager", "admin", "executive"];
        if (normalizedRole && !allowedRoles.includes(normalizedRole)) {
            return NextResponse.json(
                { success: false, error: "You are not authorized to create purchase orders from purchase requests." },
                { status: 403 }
            );
        }

        if (!request_ids || !Array.isArray(request_ids) || request_ids.length === 0) {
            return NextResponse.json(
                { success: false, error: "No purchase request IDs provided" },
                { status: 400 }
            );
        }

        // Fetch selected purchase requests
        const { data: requests, error: reqError } = await supabase
            .from("purchase_requests")
            .select("*")
            .in("id", request_ids);

        if (reqError || !requests || requests.length === 0) {
            console.error("Error fetching purchase requests for PO creation:", reqError);
            return NextResponse.json(
                { success: false, error: "Could not find selected purchase requests." },
                { status: 404 }
            );
        }

        // Fetch suppliers for email addresses
        const rawSupplierIds = requests
            .map(r => r.supplier_id)
            .filter(Boolean)
            .map(id => Number(id))
            .filter(id => !isNaN(id) && id > 0);

        const supplierIds = Array.from(new Set(rawSupplierIds));
        let supplierMap = new Map<number, any>();
        if (supplierIds.length > 0) {
            const { data: suppliers } = await supabase
                .from("suppliers")
                .select("id, name, email, contact_person")
                .in("id", supplierIds);

            if (suppliers) {
                suppliers.forEach(s => supplierMap.set(Number(s.id), s));
            }
        }

        const createdPOs = [];
        const emailResults = [];

        for (const pr of requests) {
            const poNumber = `PO-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
            const rawSupId = pr.supplier_id ? Number(pr.supplier_id) : null;
            const validSupplier = (rawSupId && !isNaN(rawSupId) && supplierMap.has(rawSupId)) ? supplierMap.get(rawSupId) : null;
            const validSupplierId = validSupplier ? Number(validSupplier.id) : null;
            const supplierName = pr.supplier_name || validSupplier?.name || "Supplier";
            const deliveryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

            // Normalize items with default prices and ensure item_name and quantity_ordered exist for database trigger
            const rawItems = Array.isArray(pr.items) && pr.items.length > 0
                ? pr.items
                : [{ name: pr.description || "Supply Item", quantity: 1, unit_price: Number(pr.amount) || 100 }];

            const items = rawItems.map((item: any) => {
                const itemName = item.item_name || item.name || item.description || pr.description || "Supply Item";
                const qty = Number(item.quantity_ordered) || Number(item.quantity) || 1;
                const price = Number(item.unit_price) || (pr.amount && rawItems.length ? Math.round(Number(pr.amount) / rawItems.length / qty) : 100);
                return {
                    item_name: itemName,
                    name: itemName,
                    quantity_ordered: qty,
                    quantity: qty,
                    quantity_received: 0,
                    unit_price: price,
                    total: qty * price
                };
            });

            const totalAmount = Number(pr.amount) || items.reduce((sum: number, it: any) => sum + it.total, 0);
            const status = send_email ? "Sent" : "Draft";

            const poData: Record<string, any> = {
                po_number: poNumber,
                request_id: pr.id,
                supplier_id: validSupplierId,
                supplier_name: supplierName,
                total_amount: totalAmount,
                status: status,
                delivery_date: deliveryDate,
                notes: pr.reason ? `Generated via AI from ${pr.request_number || 'PR'}: ${pr.reason}` : `Generated from Purchase Request ${pr.request_number || ''}`,
                items: items,
                paid: false,
                fully_received: false,
            };

            let insertedRecord: any = null;

            // Attempt 1: standard insert with select
            const { data: poInserted, error: poInsertErr } = await supabase
                .from("purchase_orders")
                .insert([poData])
                .select()
                .maybeSingle();

            if (poInserted) {
                insertedRecord = poInserted;
            } else if (poInsertErr) {
                console.error("Error inserting PO with select:", poInsertErr);
                
                // Attempt 2: fallback without supplier_id FK in case of supplier mismatch
                const safePoData = { ...poData, supplier_id: null };
                const { data: retryData, error: retryErr } = await supabase
                    .from("purchase_orders")
                    .insert([safePoData])
                    .select()
                    .maybeSingle();

                if (retryData) {
                    insertedRecord = retryData;
                } else if (!retryErr) {
                    insertedRecord = { ...safePoData, id: poNumber };
                } else {
                    console.error("Fallback insert also failed:", retryErr);
                }
            }

            if (insertedRecord) {
                createdPOs.push(insertedRecord);

                // Update purchase request status to 'Approved'
                await supabase
                    .from("purchase_requests")
                    .update({ status: "Approved", updated_at: new Date().toISOString() })
                    .eq("id", pr.id);

                // If user selected to send via Email (Brevo / SMTP)
                if (send_email && validSupplier?.email) {
                    try {
                        const origin = request.nextUrl.origin || "https://airshipexpress.ph";
                        const confirmLink = `${origin}/procurement/confirm?po=${poNumber}`;

                        const emailHtml = buildEmailTemplate({
                            poNumber: poNumber,
                            supplierName: supplierName,
                            items: items,
                            totalAmount: totalAmount,
                            deliveryDate: deliveryDate,
                            notes: poData.notes,
                            confirmLink: confirmLink,
                            senderName: user_name || "Procurement Team",
                            senderPosition: "Procurement Manager",
                            senderEmail: process.env.EMAIL_SUPPLYCHAIN_USER,
                        });

                        const sendResult = await sendSupplyChainEmail({
                            to: validSupplier.email,
                            subject: `Official Purchase Order: ${poNumber} from Airship Express`,
                            html: emailHtml,
                            senderName: "Airship Express Procurement",
                            senderEmail: process.env.EMAIL_SUPPLYCHAIN_USER,
                            replyTo: process.env.EMAIL_SUPPLYCHAIN_USER,
                        });

                        emailResults.push({ po_number: poNumber, recipient: validSupplier.email, status: "sent", messageId: sendResult.messageId });
                    } catch (e: any) {
                        console.error(`Error emailing PO ${poNumber}:`, e);
                        emailResults.push({ po_number: poNumber, recipient: validSupplier.email, status: "failed", error: e.message });
                    }
                }
            }
        }

        if (createdPOs.length === 0) {
            return NextResponse.json(
                { success: false, error: "Failed to create Purchase Orders in database. Please check table permissions or request details." },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: `Successfully created ${createdPOs.length} Purchase Order(s) marked as ${send_email ? 'Sent' : 'Draft'}.`,
            createdPOs,
            emailResults,
        });

    } catch (err: any) {
        console.error("Error in create-pos-from-requests route:", err);
        return NextResponse.json(
            { success: false, error: err.message || "Failed to create Purchase Orders" },
            { status: 500 }
        );
    }
}
