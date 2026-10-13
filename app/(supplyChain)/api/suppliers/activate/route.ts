import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_URL || "https://sswjqqpfaumxojbkkpbl.supabase.co";
const serviceRoleKey = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_ANON_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            supplierId,
            supplierData,
            documents = [],
            userId = null,
        } = body;

        if (!supplierData || !supplierData.name?.trim()) {
            return NextResponse.json(
                { success: false, error: "Supplier name is required." },
                { status: 400 }
            );
        }

        const trimmedName = supplierData.name.trim();

        let cleanNotes = (supplierData.notes || "").trim();

        // Strip any existing Terms & Conditions block if present in incoming notes
        if (cleanNotes.includes("--- Terms & Conditions ---")) {
            const parts = cleanNotes.split(/---+\s*Terms\s*&\s*Conditions\s*---+/i);
            cleanNotes = (parts[0] || "").trim();
        }

        // Strip any existing commercial parameter lines to avoid duplicating them
        const noteLines = cleanNotes.split("\n");
        const remainingNoteLines: string[] = [];
        for (const line of noteLines) {
            const trimmed = line.trim();
            if (
                /^Payment Method:\s*/i.test(trimmed) ||
                /^Payment Terms:\s*/i.test(trimmed) ||
                /^Delivery Terms:\s*/i.test(trimmed) ||
                /^Return Policy:\s*/i.test(trimmed) ||
                /^Warranty:\s*/i.test(trimmed) ||
                /^Lead Time:\s*/i.test(trimmed) ||
                /^MOQ:\s*/i.test(trimmed)
            ) {
                continue;
            }
            remainingNoteLines.push(line);
        }
        cleanNotes = remainingNoteLines.join("\n").trim();
        if (cleanNotes.startsWith("Notes: ")) {
            cleanNotes = cleanNotes.replace(/^Notes:\s*/i, "").trim();
        }

        // Format structured commercial parameters & terms & conditions into notes
        const commercialDetails = [
            supplierData.payment_method ? `Payment Method: ${supplierData.payment_method}` : null,
            supplierData.payment_terms ? `Payment Terms: ${supplierData.payment_terms}` : null,
            supplierData.delivery_terms ? `Delivery Terms: ${supplierData.delivery_terms}` : null,
            supplierData.return_policy ? `Return Policy: ${supplierData.return_policy}` : null,
            supplierData.warranty ? `Warranty: ${supplierData.warranty}` : null,
            supplierData.lead_time ? `Lead Time: ${supplierData.lead_time}` : null,
            supplierData.moq ? `MOQ: ${supplierData.moq}` : null,
        ].filter(Boolean).join("\n");

        let fullNotes = cleanNotes;
        if (commercialDetails) {
            fullNotes = fullNotes ? `${fullNotes}\n\n${commercialDetails}` : commercialDetails;
        }
        if (supplierData.terms_and_conditions && supplierData.terms_and_conditions.trim()) {
            fullNotes = fullNotes 
                ? `${fullNotes}\n\n--- Terms & Conditions ---\n${supplierData.terms_and_conditions.trim()}` 
                : `--- Terms & Conditions ---\n${supplierData.terms_and_conditions.trim()}`;
        }
        if (!fullNotes) {
            fullNotes = `Activated as Active Supplier (${new Date().toLocaleDateString()})`;
        }

        let activeSupplierId: number | null = null;
        let savedSupplier: any = null;

        // Sanitize other products offer for public.suppliers table
        const cleanOtherProductsOffer = Array.isArray(supplierData.other_products_offer)
            ? supplierData.other_products_offer.map((item: any, idx: number) => ({
                id: item.id || `op_${Date.now()}_${idx}`,
                item_name: typeof item.item_name === "string" ? item.item_name.trim() : "",
                unit: typeof item.unit === "string" ? item.unit.trim() : "unit",
                unit_price: Number(item.unit_price || 0),
                discount: Number(item.discount || 0),
                shipping_fee: Number(item.shipping_fee || 0),
                tax_classification: item.tax_classification || "vatable",
                total_amount: Number(item.total_amount != null ? item.total_amount : Number(item.unit_price || 0)),
                notes: typeof item.notes === "string" ? item.notes.trim() : "",
            }))
            : [];

        // 1. Check if existing supplier in DB
        if (supplierId && !isNaN(Number(supplierId))) {
            const numId = Number(supplierId);
            const updatePayload: any = {
                name: trimmedName,
                category: supplierData.category || "General Supplies",
                contact_person: supplierData.contact_person || "Store Contact",
                phone: supplierData.phone || "",
                email: supplierData.email || "",
                location: supplierData.location || "Metro Manila, Philippines",
                products: supplierData.products || "",
                fb_link: supplierData.website || "",
                notes: fullNotes,
                is_active: true,
                other_products_offer: cleanOtherProductsOffer,
            };

            let { data: updated, error: updateError } = await supabaseAdmin
                .from("suppliers")
                .update(updatePayload)
                .eq("id", numId)
                .select()
                .single();

            if (updateError && (updateError.message?.includes("other_products_offer") || (updateError as any).code === "PGRST204" || (updateError as any).code === "42703")) {
                console.warn("other_products_offer column missing in suppliers, retrying update without it:", updateError);
                delete updatePayload.other_products_offer;
                const retryRes = await supabaseAdmin
                    .from("suppliers")
                    .update(updatePayload)
                    .eq("id", numId)
                    .select()
                    .single();
                updated = retryRes.data;
                updateError = retryRes.error;
            }

            if (updateError) {
                console.error("Error updating existing supplier:", updateError);
                throw updateError;
            }
            savedSupplier = updated;
            activeSupplierId = numId;
        } else {
            // Check if a supplier with the same name already exists
            const { data: existingSuppliers } = await supabaseAdmin
                .from("suppliers")
                .select("*")
                .ilike("name", trimmedName)
                .limit(1);

            if (existingSuppliers && existingSuppliers.length > 0) {
                const ex = existingSuppliers[0];
                const updatePayload: any = {
                    category: supplierData.category || ex.category,
                    contact_person: supplierData.contact_person || ex.contact_person,
                    phone: supplierData.phone || ex.phone,
                    email: supplierData.email || ex.email,
                    location: supplierData.location || ex.location,
                    products: supplierData.products || ex.products,
                    fb_link: supplierData.website || ex.fb_link,
                    notes: fullNotes,
                    is_active: true,
                    other_products_offer: cleanOtherProductsOffer,
                };

                let { data: updated, error: updateError } = await supabaseAdmin
                    .from("suppliers")
                    .update(updatePayload)
                    .eq("id", ex.id)
                    .select()
                    .single();

                if (updateError && (updateError.message?.includes("other_products_offer") || (updateError as any).code === "PGRST204" || (updateError as any).code === "42703")) {
                    console.warn("other_products_offer column missing in suppliers, retrying update without it:", updateError);
                    delete updatePayload.other_products_offer;
                    const retryRes = await supabaseAdmin
                        .from("suppliers")
                        .update(updatePayload)
                        .eq("id", ex.id)
                        .select()
                        .single();
                    updated = retryRes.data;
                    updateError = retryRes.error;
                }

                if (updateError) throw updateError;
                savedSupplier = updated;
                activeSupplierId = ex.id;
            } else {
                // Insert new active supplier
                const insertPayload: any = {
                    name: trimmedName,
                    category: supplierData.category || "General Supplies",
                    contact_person: supplierData.contact_person || "Store Contact",
                    phone: supplierData.phone || "",
                    email: supplierData.email || "",
                    location: supplierData.location || "Metro Manila, Philippines",
                    products: supplierData.products || "",
                    fb_link: supplierData.website || "",
                    notes: fullNotes,
                    is_active: true,
                    other_products_offer: cleanOtherProductsOffer,
                };

                let { data: inserted, error: insertError } = await supabaseAdmin
                    .from("suppliers")
                    .insert(insertPayload)
                    .select()
                    .single();

                if (insertError && (insertError.message?.includes("other_products_offer") || (insertError as any).code === "PGRST204" || (insertError as any).code === "42703")) {
                    console.warn("other_products_offer column missing in suppliers, retrying insert without it:", insertError);
                    delete insertPayload.other_products_offer;
                    const retryRes = await supabaseAdmin
                        .from("suppliers")
                        .insert(insertPayload)
                        .select()
                        .single();
                    inserted = retryRes.data;
                    insertError = retryRes.error;
                }

                if (insertError) {
                    console.error("Error inserting new active supplier:", insertError);
                    throw insertError;
                }
                savedSupplier = inserted;
                activeSupplierId = inserted.id;
            }
        }

        if (!activeSupplierId) {
            throw new Error("Failed to resolve active supplier ID.");
        }

        // 2. Upload and record verification documents if provided
        const uploadedDocs: any[] = [];
        if (Array.isArray(documents) && documents.length > 0) {
            // Ensure bucket exists
            try {
                await supabaseAdmin.storage.createBucket("supplier_documents", { public: true });
            } catch (bErr) {
                // Bucket already exists, ignore
            }

            for (const doc of documents) {
                if (!doc.file_base64) continue;

                let base64Clean = doc.file_base64;
                let mimeType = doc.file_type || "application/pdf";
                if (doc.file_base64.includes(";base64,")) {
                    const parts = doc.file_base64.split(";base64,");
                    const mimeMatch = parts[0].match(/data:(.*?)$/);
                    if (mimeMatch && mimeMatch[1]) {
                        mimeType = mimeMatch[1];
                    }
                    base64Clean = parts[1];
                }

                const fileBuffer = Buffer.from(base64Clean, "base64");
                const safeName = (doc.file_name || "doc").replace(/[^a-zA-Z0-9._-]/g, "_");
                const storagePath = `suppliers/${activeSupplierId}/${Date.now()}_${safeName}`;

                const { error: uploadError } = await supabaseAdmin.storage
                    .from("supplier_documents")
                    .upload(storagePath, fileBuffer, {
                        contentType: mimeType,
                        upsert: true,
                    });

                if (uploadError) {
                    console.error("Error uploading supplier document to storage:", uploadError);
                }

                const { data: publicUrlData } = supabaseAdmin.storage
                    .from("supplier_documents")
                    .getPublicUrl(storagePath);
                const fileUrl = publicUrlData?.publicUrl || null;

                // Insert into public.supplier_documents
                const { data: docRecord, error: docDbError } = await supabaseAdmin
                    .from("supplier_documents")
                    .insert({
                        supplier_id: activeSupplierId,
                        document_type: doc.document_type || "Business Document",
                        file_name: doc.file_name || safeName,
                        storage_path: storagePath,
                        file_url: fileUrl,
                        extracted_text: doc.extracted_text || null,
                        extracted_data: doc.extracted_data || null,
                        uploaded_by: userId || null,
                    })
                    .select()
                    .single();

                if (docDbError) {
                    console.error("Error inserting record into supplier_documents table:", docDbError);
                } else if (docRecord) {
                    uploadedDocs.push(docRecord);
                }
            }
        }

        const successMessage = `Supplier "${savedSupplier.name}" has been successfully reviewed and registered in the Supplier Directory!`;

        return NextResponse.json({
            success: true,
            supplier: savedSupplier,
            supplierId: activeSupplierId,
            documentsUploaded: uploadedDocs.length,
            accountProvisioned: false,
            emailSent: false,
            message: successMessage,
        });
    } catch (error: any) {
        console.error("Error activating supplier:", error);
        return NextResponse.json(
            { success: false, error: error?.message || "Failed to activate supplier" },
            { status: 500 }
        );
    }
}
