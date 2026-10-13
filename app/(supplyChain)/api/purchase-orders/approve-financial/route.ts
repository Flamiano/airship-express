// app/(supplyChain)/api/purchase-orders/approve-financial/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendSupplyChainEmail } from "../../../lib/email/mailer";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_URL || "";
const serviceRoleKey = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { po_id, po_number, financial_approval = "Approved", approved_by } = body;

        if (!po_id && !po_number) {
            return NextResponse.json(
                { success: false, error: "po_id or po_number is required" },
                { status: 400 }
            );
        }

        // 1. Fetch current PO details
        let query = supabase.from("purchase_orders").select("*");
        if (po_id) {
            query = query.eq("id", po_id);
        } else if (po_number) {
            query = query.eq("po_number", po_number);
        }

        const { data: po, error: fetchErr } = await query.single();
        if (fetchErr || !po) {
            return NextResponse.json(
                { success: false, error: "Purchase order not found" },
                { status: 404 }
            );
        }

        // 2. Update financial approval status
        const now = new Date().toISOString();
        const updatePayload: Record<string, any> = {
            financial_approval,
            financial_approved_at: financial_approval === "Approved" ? now : null,
            status: financial_approval === "Approved" ? "Issued" : "Pending",
            updated_at: now,
        };

        if (approved_by) {
            updatePayload.financial_approved_by = approved_by;
        }

        const { error: updateErr } = await supabase
            .from("purchase_orders")
            .update(updatePayload)
            .eq("id", po.id);

        if (updateErr) {
            return NextResponse.json(
                { success: false, error: updateErr.message },
                { status: 500 }
            );
        }

        // 3. If financial approval is "Approved", automatically email the supplier
        let emailResult: any = null;
        if (financial_approval === "Approved") {
            // Find supplier's contact email
            let supplierEmail: string | null = null;
            let supplierContact: string | null = null;

            if (po.supplier_id) {
                const { data: supp } = await supabase
                    .from("suppliers")
                    .select("email, contact_person, name")
                    .eq("id", po.supplier_id)
                    .maybeSingle();

                if (supp?.email) {
                    supplierEmail = supp.email;
                    supplierContact = supp.contact_person || supp.name;
                }
            }

            // Fallback: search by supplier_name if email not found yet
            if (!supplierEmail && po.supplier_name) {
                const { data: supp } = await supabase
                    .from("suppliers")
                    .select("email, contact_person, name")
                    .ilike("name", po.supplier_name.trim())
                    .maybeSingle();

                if (supp?.email) {
                    supplierEmail = supp.email;
                    supplierContact = supp.contact_person || supp.name;
                }
            }

            if (supplierEmail) {
                const itemsList = Array.isArray(po.items) ? po.items : [];
                const itemsHtml = itemsList
                    .map(
                        (it: any) => `
                        <tr style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 10px 12px; font-size: 13px; color: #1e293b; font-weight: 600;">${it.name || it.item_name || "Supplied Goods"}</td>
                            <td style="padding: 10px 12px; font-size: 13px; color: #475569; text-align: center;">${it.quantity || it.quantity_ordered || 1}</td>
                            <td style="padding: 10px 12px; font-size: 13px; color: #475569; text-align: right;">₱${Number(it.unit_price || 0).toLocaleString()}</td>
                            <td style="padding: 10px 12px; font-size: 13px; color: #db2777; font-weight: bold; text-align: right;">₱${Number(it.total || 0).toLocaleString()}</td>
                        </tr>
                    `
                    )
                    .join("");

                const emailHtml = `
                    <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
                        <div style="background: linear-gradient(135deg, #db2777, #9333ea); padding: 28px; text-align: center; color: #ffffff;">
                            <h1 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 900;">Official Purchase Order Awarded</h1>
                            <p style="margin: 0; font-size: 13px; opacity: 0.9;">Airship Express Supply Chain Management</p>
                        </div>
                        <div style="padding: 24px; color: #334155;">
                            <p style="font-size: 14px; margin-top: 0;">Dear <strong>${supplierContact || po.supplier_name}</strong>,</p>
                            <p style="font-size: 13px; line-height: 1.6;">
                                We are pleased to inform you that your proposal for <strong>${po.po_number}</strong> has received <strong>Finance & Administrative Approval</strong>. The official Purchase Order has been issued and approved for fulfillment.
                            </p>
                            
                            <div style="background-color: #f8fafc; border-radius: 12px; padding: 16px; margin: 20px 0; border: 1px solid #e2e8f0;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px;">
                                    <span style="color: #64748b;">PO Number:</span>
                                    <strong style="color: #0f172a; font-family: monospace;">${po.po_number}</strong>
                                </div>
                                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px;">
                                    <span style="color: #64748b;">Total Value:</span>
                                    <strong style="color: #db2777; font-size: 14px;">₱${Number(po.total_amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</strong>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 12px;">
                                    <span style="color: #64748b;">Expected Delivery:</span>
                                    <strong style="color: #0f172a;">${po.delivery_date || "As Agreed"}</strong>
                                </div>
                            </div>

                            <h3 style="font-size: 14px; color: #0f172a; margin: 20px 0 10px 0;">Order Line Items:</h3>
                            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                                <thead>
                                    <tr style="background-color: #f1f5f9; text-align: left; font-size: 11px; text-transform: uppercase; color: #64748b;">
                                        <th style="padding: 8px 12px;">Item</th>
                                        <th style="padding: 8px 12px; text-align: center;">Qty</th>
                                        <th style="padding: 8px 12px; text-align: right;">Unit Price</th>
                                        <th style="padding: 8px 12px; text-align: right;">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemsHtml}
                                </tbody>
                            </table>

                            ${po.notes ? `<div style="font-size: 12px; color: #64748b; background: #fff1f2; border-left: 3px solid #db2777; padding: 10px 12px; margin-bottom: 20px; border-radius: 4px;"><strong>Order Notes:</strong> ${po.notes}</div>` : ""}

                            <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin-bottom: 0;">
                                Please review this purchase order and reply with your dispatch schedule and tracking details. Thank you for your partnership!
                            </p>
                        </div>
                        <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
                            Airship Express Logistics & Supply Chain Procurement Operations
                        </div>
                    </div>
                `;

                try {
                    emailResult = await sendSupplyChainEmail({
                        to: { email: supplierEmail, name: supplierContact || po.supplier_name },
                        subject: `[Approved PO] Purchase Order ${po.po_number} - Airship Express`,
                        html: emailHtml,
                    });
                } catch (emailErr: any) {
                    console.warn("Could not dispatch financial approval email to supplier:", emailErr);
                    emailResult = { success: false, error: emailErr.message };
                }
            }
        }

        return NextResponse.json({
            success: true,
            po_id: po.id,
            po_number: po.po_number,
            financial_approval,
            email_sent: emailResult?.success ?? false,
            email_details: emailResult,
        });
    } catch (err: any) {
        return NextResponse.json(
            { success: false, error: err?.message || "Internal server error" },
            { status: 500 }
        );
    }
}
