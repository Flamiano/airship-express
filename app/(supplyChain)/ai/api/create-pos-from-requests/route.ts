// app/(supplyChain)/ai/api/create-pos-from-requests/route.ts

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/(supplyChain)/lib/services/client/supabase";
import { buildEmailTemplate } from "@/app/(supplyChain)/(pages)/procurement/api/send-email/template";
import nodemailer from "nodemailer";

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
        const supplierIds = Array.from(new Set(requests.map(r => r.supplier_id).filter(Boolean)));
        let supplierMap = new Map<string, any>();
        if (supplierIds.length > 0) {
            const { data: suppliers } = await supabase
                .from("suppliers")
                .select("id, name, email, contact_person")
                .in("id", supplierIds);

            if (suppliers) {
                suppliers.forEach(s => supplierMap.set(s.id, s));
            }
        }

        const createdPOs = [];
        const emailResults = [];

        for (const pr of requests) {
            const poNumber = `PO-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
            const supplier = pr.supplier_id ? supplierMap.get(pr.supplier_id) : null;
            const deliveryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

            // Normalize items with default prices if missing
            const rawItems = Array.isArray(pr.items) ? pr.items : [];
            const items = rawItems.map((item: any) => {
                const qty = Number(item.quantity) || 1;
                const price = Number(item.unit_price) || (pr.amount && rawItems.length ? Math.round(Number(pr.amount) / rawItems.length / qty) : 100);
                return {
                    name: item.name || "Item",
                    quantity: qty,
                    unit_price: price,
                    total: qty * price
                };
            });

            const totalAmount = Number(pr.amount) || items.reduce((sum: number, it: any) => sum + it.total, 0);
            const status = send_email ? "Sent" : "Draft";

            const poData: Record<string, any> = {
                po_number: poNumber,
                request_id: pr.id,
                supplier_id: pr.supplier_id,
                supplier_name: pr.supplier_name || supplier?.name || "Supplier",
                total_amount: totalAmount,
                status: status,
                delivery_date: deliveryDate,
                notes: pr.reason ? `Generated via AI from ${pr.request_number || 'PR'}: ${pr.reason}` : `Generated from Purchase Request ${pr.request_number || ''}`,
                items: items,
            };

            const { data: poInserted, error: poInsertErr } = await supabase
                .from("purchase_orders")
                .insert([poData])
                .select()
                .single();

            if (poInsertErr) {
                console.error("Error inserting PO:", poInsertErr);
                // Fallback insert without select
                const { error: fallbackErr } = await supabase
                    .from("purchase_orders")
                    .insert([poData]);
                
                if (!fallbackErr) {
                    createdPOs.push({ ...poData, id: poNumber });
                }
            } else if (poInserted) {
                createdPOs.push(poInserted);
            }

            // Update purchase request status to 'Approved'
            await supabase
                .from("purchase_requests")
                .update({ status: "Approved", updated_at: new Date().toISOString() })
                .eq("id", pr.id);

                // If user selected to send via Gmail
                if (send_email && supplier?.email && process.env.EMAIL_SUPPLYCHAIN_USER && process.env.EMAIL_SUPPLYCHAIN_PASS) {
                    try {
                        const transporter = nodemailer.createTransport({
                            service: "gmail",
                            auth: {
                                user: process.env.EMAIL_SUPPLYCHAIN_USER,
                                pass: process.env.EMAIL_SUPPLYCHAIN_PASS,
                            },
                        });

                        const origin = request.nextUrl.origin || "https://airshipexpress.ph";
                        const confirmLink = `${origin}/procurement/confirm?po=${poNumber}`;

                        const emailHtml = buildEmailTemplate({
                            poNumber: poNumber,
                            supplierName: supplier.name || pr.supplier_name,
                            items: items,
                            totalAmount: totalAmount,
                            deliveryDate: deliveryDate,
                            notes: poData.notes,
                            confirmLink: confirmLink,
                            senderName: user_name || "Procurement Team",
                            senderPosition: "Procurement Manager",
                            senderEmail: process.env.EMAIL_SUPPLYCHAIN_USER,
                        });

                        const info = await transporter.sendMail({
                            from: `"AirshipExpress Procurement" <${process.env.EMAIL_SUPPLYCHAIN_USER}>`,
                            to: supplier.email,
                            subject: `Official Purchase Order: ${poNumber} from Airship Express`,
                            html: emailHtml,
                            replyTo: process.env.EMAIL_SUPPLYCHAIN_USER,
                        });

                        emailResults.push({ po_number: poNumber, recipient: supplier.email, status: "sent", messageId: info.messageId });
                    } catch (e: any) {
                        console.error(`Error emailing PO ${poNumber}:`, e);
                        emailResults.push({ po_number: poNumber, recipient: supplier.email, status: "failed", error: e.message });
                    }
                }
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
