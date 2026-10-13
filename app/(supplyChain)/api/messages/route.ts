import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_URL || "";
const serviceRoleKey =
    process.env.SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_ANON_KEY ||
    "";

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
});

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const supplierId = searchParams.get("supplier_id");

        if (!supplierId) {
            return NextResponse.json(
                { success: false, error: "supplier_id is required" },
                { status: 400 }
            );
        }

        const { data, error } = await supabaseAdmin
            .from("messages")
            .select("*")
            .eq("supplier_id", supplierId)
            .order("created_at", { ascending: true });

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data: data || [] });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            supplier_id,
            purchase_order_id,
            sender_type,
            sender_id,
            sender_name,
            sender_email,
            sender_role,
            role,
            message,
            attachments,
            is_read,
            created_at,
        } = body;

        if (!supplier_id || !message) {
            return NextResponse.json(
                { success: false, error: "supplier_id and message are required" },
                { status: 400 }
            );
        }

        // Validate and resolve foreign key supplier_id in public.suppliers table
        let resolvedSupplierId: number | null = null;
        const numericId = Number(supplier_id);
        const searchName = body.supplier_name || body.recipient_name || '';

        // 1. Try resolving by supplier_name if provided
        if (searchName) {
            const cleanName = searchName.split(" - ")[0].trim();
            const { data: matchedByName } = await supabaseAdmin
                .from("suppliers")
                .select("id")
                .or(`name.ilike.%${cleanName}%,name.ilike.%${searchName.trim()}%`)
                .limit(1)
                .maybeSingle();

            if (matchedByName?.id) {
                resolvedSupplierId = matchedByName.id;
            }
        }

        // 2. Try resolving by numeric supplier_id
        if (!resolvedSupplierId && !isNaN(numericId) && numericId > 0) {
            const { data: existing } = await supabaseAdmin
                .from("suppliers")
                .select("id")
                .eq("id", numericId)
                .maybeSingle();

            if (existing?.id) {
                resolvedSupplierId = existing.id;
            }
        }

        // 3. If not found, look up first active supplier or provision
        if (!resolvedSupplierId) {
            const { data: firstSupp } = await supabaseAdmin
                .from("suppliers")
                .select("id")
                .order("id", { ascending: true })
                .limit(1)
                .maybeSingle();

            if (firstSupp?.id) {
                resolvedSupplierId = firstSupp.id;
            } else {
                const { data: newSupp } = await supabaseAdmin
                    .from("suppliers")
                    .insert({
                        name: searchName || "General Supplier",
                        category: "General Supplies",
                        phone: "09123456789",
                        email: "supplier@airship.com",
                        location: "Manila, Philippines",
                        is_active: true,
                    })
                    .select("id")
                    .single();

                if (newSupp?.id) {
                    resolvedSupplierId = newSupp.id;
                }
            }
        }

        const messagePayload = {
            supplier_id: resolvedSupplierId || Number(supplier_id),
            purchase_order_id: purchase_order_id || null,
            sender_type: sender_type || "internal",
            sender_id: sender_id || null,
            sender_name: sender_name || "Staff",
            sender_email: sender_email || "staff@airship.com",
            sender_role: sender_role || role || "Staff",
            role: role || sender_role || "Staff",
            message: message.trim(),
            attachments: attachments || [],
            is_read: is_read ?? false,
            created_at: created_at || new Date().toISOString(),
        };

        const { data, error } = await supabaseAdmin
            .from("messages")
            .insert(messagePayload)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { success: false, error: "Message id is required" },
                { status: 400 }
            );
        }

        const { error } = await supabaseAdmin
            .from("messages")
            .delete()
            .eq("id", id);

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
