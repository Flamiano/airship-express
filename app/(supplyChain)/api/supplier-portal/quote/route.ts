// app/(supplyChain)/api/supplier-portal/quote/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase as clientSupabase } from "../../../lib/services/client/supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_URL || "";
const serviceRoleKey = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_ANON_KEY || "";

const dbClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const name = searchParams.get("name") || "";
        const id = searchParams.get("id") || "";
        const reqNumber = searchParams.get("req") || searchParams.get("request_number") || "";
        const supabase = dbClient || clientSupabase;

        // 1. Fetch categories ONLY from suppliers where is_active is explicitly true
        const { data: activeSuppliers, error: catError } = await supabase
            .from("suppliers")
            .select("category, is_active")
            .eq("is_active", true);

        if (catError) {
            console.error("Error fetching active categories:", catError);
        }

        const activeCategoriesSet = new Set<string>();
        if (activeSuppliers) {
            activeSuppliers.forEach((s) => {
                if (s.is_active === true && s.category && s.category.trim()) {
                    activeCategoriesSet.add(s.category.trim());
                }
            });
        }

        // 2. Fetch specific supplier info if requested
        let supplierInfo: any = null;
        if (id) {
            const { data: byId } = await supabase
                .from("suppliers")
                .select("id, name, category, location, phone, email, contact_person, products, services_offered, is_active")
                .eq("id", id)
                .limit(1)
                .maybeSingle();
            supplierInfo = byId;
        } else if (name.trim()) {
            const { data: byName } = await supabase
                .from("suppliers")
                .select("id, name, category, location, phone, email, contact_person, products, services_offered, is_active")
                .ilike("name", name.trim())
                .limit(1)
                .maybeSingle();
            supplierInfo = byName;
        }

        // 3. Fetch all supplier_quotations for this requisition
        let quotationsQuery = supabase
            .from("supplier_quotations")
            .select("*");

        if (reqNumber && reqNumber.trim()) {
            const cleanReq = reqNumber.trim();
            quotationsQuery = quotationsQuery.or(`request_number.eq.${cleanReq},request_number.ilike.%${cleanReq}%`);
        }

        const { data: quotationsList, error: quoteFetchError } = await quotationsQuery.order("unit_price", { ascending: true });

        if (quoteFetchError) {
            console.error("Error fetching supplier quotations:", quoteFetchError);
        }

        // Find existing quote for this supplier if present
        let existingQuote: any = null;
        if (quotationsList && quotationsList.length > 0 && (name.trim() || id)) {
            existingQuote = quotationsList.find((q: any) => {
                const matchId = id && q.supplier_id && Number(q.supplier_id) === Number(id);
                const matchName = name && q.supplier_name && q.supplier_name.trim().toLowerCase() === name.trim().toLowerCase();
                return matchId || matchName;
            }) || null;
        }

        return NextResponse.json({
            success: true,
            categories: Array.from(activeCategoriesSet),
            supplier: supplierInfo,
            quotations: quotationsList || [],
            existingQuote: existingQuote || null,
        });
    } catch (err: any) {
        console.error("Error in GET /api/supplier-portal/quote:", err);
        return NextResponse.json(
            { success: false, error: err?.message || "Failed to fetch categories and quotations." },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            supplier_id,
            supplier_name,
            category,
            location,
            contact_person,
            contact_phone,
            contact_email,
            products,
            request_number,
            item_name,
            quantity,
            unit,
            unit_price,
            subtotal,
            shipping_fee = 0,
            discount = 0,
            tax_type,
            tax_rate = 0,
            tax_amount = 0,
            total_amount,
            availability,
            lead_time_days,
            services_offered = [],
            other_products_offer = [],
            notes = "",
            is_update = false,
        } = body;

        if (!supplier_name || !supplier_name.trim()) {
            return NextResponse.json(
                { success: false, error: "Supplier / Company name is required." },
                { status: 400 }
            );
        }

        if (!category || !category.trim()) {
            return NextResponse.json(
                { success: false, error: "Supplier business category is required." },
                { status: 400 }
            );
        }

        if (!contact_person || !contact_person.trim()) {
            return NextResponse.json(
                { success: false, error: "Contact person name is required." },
                { status: 400 }
            );
        }

        if (!contact_phone || !contact_phone.trim()) {
            return NextResponse.json(
                { success: false, error: "Phone / mobile number is required." },
                { status: 400 }
            );
        }

        if (!contact_email || !contact_email.trim()) {
            return NextResponse.json(
                { success: false, error: "Official business email is required." },
                { status: 400 }
            );
        }

        if (!availability || !availability.trim()) {
            return NextResponse.json(
                { success: false, error: "Stock availability status is required." },
                { status: 400 }
            );
        }

        if (!unit_price || Number(unit_price) <= 0) {
            return NextResponse.json(
                { success: false, error: "A valid unit price is required." },
                { status: 400 }
            );
        }

        if (!lead_time_days || !lead_time_days.trim()) {
            return NextResponse.json(
                { success: false, error: "Delivery lead time is required." },
                { status: 400 }
            );
        }

        if (!notes || !notes.trim()) {
            return NextResponse.json(
                { success: false, error: "Proposal remarks or specifications are required." },
                { status: 400 }
            );
        }

        const supabase = dbClient || clientSupabase;
        const supplierCategory = category.trim();
        const cleanProducts = (products && typeof products === "string" && products.trim()) 
            ? products.trim() 
            : (item_name ? String(item_name).trim() : "General Supplies & Catalog Items");

        const cleanServices: string[] = Array.isArray(services_offered)
            ? services_offered.filter(Boolean)
            : services_offered ? [String(services_offered)] : [];

        // Parse optional other products offer array (unit price, unit option, tax, shipping, discount)
        const cleanOtherProductsOffer = Array.isArray(other_products_offer)
            ? other_products_offer.map((item: any, idx: number) => {
                const itemPrice = Math.max(0, Number(item?.unit_price || 0));
                const itemSubtotal = itemPrice;
                const itemDiscount = Math.max(0, Number(item?.discount || 0));
                const itemShipping = Math.max(0, Number(item?.shipping_fee || 0));
                const taxClass = String(item?.tax_classification || item?.tax_type || "VAT (12%)").trim();
                let itemTaxRate = Number(item?.tax_rate !== undefined && item?.tax_rate !== null ? item.tax_rate : 0);
                if ((taxClass === "VAT (12%)" || taxClass === "vatable") && (item?.tax_rate === undefined || item?.tax_rate === null)) itemTaxRate = 12;
                if (taxClass === "Non-VAT / Exempt (0%)" || taxClass === "Zero-Rated (0%)" || taxClass === "zero_rated" || taxClass === "exempt") itemTaxRate = 0;
                if ((taxClass === "Others" || taxClass.startsWith("Others")) && (item?.tax_rate === undefined || item?.tax_rate === null)) itemTaxRate = 12;
                const taxable = Math.max(0, itemSubtotal - itemDiscount);
                const itemTax = (taxable * itemTaxRate) / 100;
                const itemTotal = taxable + itemShipping + itemTax;

                return {
                    id: item?.id || `offer-${Date.now()}-${idx}`,
                    item_name: String(item?.item_name || "").trim(),
                    unit: String(item?.unit || "units").trim(),
                    unit_price: itemPrice,
                    subtotal: itemSubtotal,
                    discount: itemDiscount,
                    shipping_fee: itemShipping,
                    tax_classification: taxClass,
                    tax_rate: itemTaxRate,
                    tax_amount: itemTax,
                    total_amount: Number(item?.total_amount || itemTotal),
                    notes: item?.notes ? String(item.notes).trim() : "",
                };
            }).filter((it: any) => it.item_name || it.unit_price > 0)
            : [];

        // Format clean quote summary
        const servicesList = cleanServices.join(", ");
        const quoteNote = `[Quotation for ${request_number || "Requisition"}]: Category: ${supplierCategory} | Products: ${cleanProducts} | ₱${Number(unit_price).toLocaleString()}/${unit || "unit"} (${availability || "In Stock"}) | Lead Time: ${lead_time_days} days | Services: ${servicesList || "Standard"} ${notes ? `| Note: ${notes}` : ""}`.trim();

        // 1. Resolve matching purchase request UUID if request_number provided
        let matchedPrId: string | null = null;
        if (request_number) {
            const cleanReq = request_number.trim();
            const { data: matchedPr } = await supabase
                .from("purchase_requests")
                .select("id")
                .or(`request_number.eq.${cleanReq},id.eq.${cleanReq}`)
                .limit(1)
                .maybeSingle();

            if (matchedPr?.id) {
                matchedPrId = matchedPr.id;
            }

            // Check if bidding for this requisition has already concluded and been awarded
            const { data: awardedQuotes } = await supabase
                .from("supplier_quotations")
                .select("id, supplier_name, status")
                .eq("status", "accepted")
                .or(`request_number.eq.${cleanReq},request_number.ilike.%${cleanReq}%`)
                .limit(1);

            if (awardedQuotes && awardedQuotes.length > 0) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `Bidding has concluded for requisition #${cleanReq}. The bid has already been awarded to ${awardedQuotes[0].supplier_name || "a selected supplier"}.`,
                    },
                    { status: 400 }
                );
            }
        }

        // 2. Check if supplier exists in database by id, name, or email
        let matchedSupplier: any = null;

        if (supplier_id) {
            const { data: byId } = await supabase
                .from("suppliers")
                .select("*")
                .eq("id", supplier_id)
                .limit(1)
                .maybeSingle();
            if (byId) matchedSupplier = byId;
        }

        if (!matchedSupplier) {
            const { data: byName } = await supabase
                .from("suppliers")
                .select("*")
                .ilike("name", supplier_name.trim())
                .limit(1)
                .maybeSingle();
            if (byName) matchedSupplier = byName;
        }

        if (!matchedSupplier && contact_email && contact_email.trim()) {
            const { data: byEmail } = await supabase
                .from("suppliers")
                .select("*")
                .ilike("email", contact_email.trim())
                .limit(1)
                .maybeSingle();
            if (byEmail) matchedSupplier = byEmail;
        }

        const matchedSupplierId = matchedSupplier ? matchedSupplier.id : null;
        const reqNumber = request_number?.trim() || "REQ-GENERAL";

        // 3. Check if a quote already exists for this supplier under THIS specific request
        let existingQuoteQuery = supabase
            .from("supplier_quotations")
            .select("id, supplier_id, supplier_name, created_at, status")
            .eq("request_number", reqNumber);

        if (matchedSupplierId) {
            existingQuoteQuery = existingQuoteQuery.or(`supplier_id.eq.${matchedSupplierId},supplier_name.ilike.${supplier_name.trim()}`);
        } else {
            existingQuoteQuery = existingQuoteQuery.ilike("supplier_name", supplier_name.trim());
        }

        const { data: existingQuotes } = await existingQuoteQuery.limit(1);
        const existingQuote = existingQuotes && existingQuotes.length > 0 ? existingQuotes[0] : null;

        let resultQuoteId: number | null = null;
        let isUpdated = false;

        const calcQty = Number(quantity || 1);
        const calcUnitPrice = Number(unit_price || 0);
        const calcSubtotal = subtotal !== undefined && subtotal !== null ? Number(subtotal) : (calcUnitPrice * calcQty);
        const calcShippingFee = Number(shipping_fee || 0);
        const calcDiscount = Number(discount || 0);
        const calcTaxRate = Number(tax_rate || 0);
        const calcTaxAmount = Number(tax_amount || 0);
        const calcTaxType = tax_type ? String(tax_type) : null;
        const calculatedTotal = Number(
            total_amount !== undefined && total_amount !== null
                ? total_amount
                : (calcSubtotal - calcDiscount + calcShippingFee + calcTaxAmount)
        );

        // 4. Update existing quotation OR insert new quotation record
        if (existingQuote) {
            // ALLOW UPDATING QUOTATION AFTER SUBMISSION
            const quoteUpdatePayload: Record<string, any> = {
                supplier_id: matchedSupplierId || existingQuote.supplier_id,
                supplier_name: supplier_name.trim(),
                contact_person: contact_person?.trim() || null,
                contact_phone: contact_phone?.trim() || null,
                contact_email: contact_email?.trim() || null,
                item_name: item_name || "Requested Goods",
                products: cleanProducts,
                quantity: calcQty,
                unit: unit || "units",
                unit_price: calcUnitPrice,
                subtotal: calcSubtotal,
                shipping_fee: calcShippingFee,
                discount: calcDiscount,
                tax_type: calcTaxType,
                tax_rate: calcTaxRate,
                tax_amount: calcTaxAmount,
                total_amount: calculatedTotal,
                availability: availability || "In Stock (Immediate Dispatch)",
                lead_time_days: lead_time_days || "2-3",
                services_offered: cleanServices,
                other_products_offer: cleanOtherProductsOffer,
                notes: `[Category: ${supplierCategory}] ${notes?.trim() || ""}`.trim(),
                updated_at: new Date().toISOString(),
            };

            let { data: updatedQuote, error: quoteUpdateError } = await supabase
                .from("supplier_quotations")
                .update(quoteUpdatePayload)
                .eq("id", existingQuote.id)
                .select()
                .single();

            // Fallback in case columns aren't in supplier_quotations yet
            if (quoteUpdateError && (
                quoteUpdateError.message?.includes("products") ||
                quoteUpdateError.message?.includes("other_products_offer") ||
                quoteUpdateError.message?.includes("subtotal") ||
                quoteUpdateError.message?.includes("shipping_fee") ||
                quoteUpdateError.message?.includes("tax_")
            )) {
                delete quoteUpdatePayload.other_products_offer;
                delete quoteUpdatePayload.products;
                delete quoteUpdatePayload.subtotal;
                delete quoteUpdatePayload.shipping_fee;
                delete quoteUpdatePayload.discount;
                delete quoteUpdatePayload.tax_type;
                delete quoteUpdatePayload.tax_rate;
                delete quoteUpdatePayload.tax_amount;
                const retry = await supabase
                    .from("supplier_quotations")
                    .update(quoteUpdatePayload)
                    .eq("id", existingQuote.id)
                    .select()
                    .single();
                updatedQuote = retry.data;
                quoteUpdateError = retry.error;
            }

            if (quoteUpdateError) {
                console.error("Database error updating supplier_quotations:", quoteUpdateError);
                return NextResponse.json(
                    { success: false, error: quoteUpdateError.message || "Failed to update quotation." },
                    { status: 500 }
                );
            }

            resultQuoteId = existingQuote.id;
            isUpdated = true;
        } else {
            // Insert new quotation record
            const quotePayload: Record<string, any> = {
                supplier_id: matchedSupplierId,
                supplier_name: supplier_name.trim(),
                contact_person: contact_person?.trim() || null,
                contact_phone: contact_phone?.trim() || null,
                contact_email: contact_email?.trim() || null,
                request_number: reqNumber,
                item_name: item_name || "Requested Goods",
                products: cleanProducts,
                quantity: calcQty,
                unit: unit || "units",
                unit_price: calcUnitPrice,
                subtotal: calcSubtotal,
                shipping_fee: calcShippingFee,
                discount: calcDiscount,
                tax_type: calcTaxType,
                tax_rate: calcTaxRate,
                tax_amount: calcTaxAmount,
                total_amount: calculatedTotal,
                availability: availability || "In Stock (Immediate Dispatch)",
                lead_time_days: lead_time_days || "2-3",
                services_offered: cleanServices,
                other_products_offer: cleanOtherProductsOffer,
                notes: `[Category: ${supplierCategory}] ${notes?.trim() || ""}`.trim(),
                status: "pending",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

            let { data: insertedQuote, error: quoteInsertError } = await supabase
                .from("supplier_quotations")
                .insert(quotePayload)
                .select()
                .single();

            // Fallback in case columns aren't in supplier_quotations yet
            if (quoteInsertError && (
                quoteInsertError.message?.includes("products") ||
                quoteInsertError.message?.includes("other_products_offer") ||
                quoteInsertError.message?.includes("subtotal") ||
                quoteInsertError.message?.includes("shipping_fee") ||
                quoteInsertError.message?.includes("tax_")
            )) {
                delete quotePayload.other_products_offer;
                delete quotePayload.products;
                delete quotePayload.subtotal;
                delete quotePayload.shipping_fee;
                delete quotePayload.discount;
                delete quotePayload.tax_type;
                delete quotePayload.tax_rate;
                delete quotePayload.tax_amount;
                const retry = await supabase
                    .from("supplier_quotations")
                    .insert(quotePayload)
                    .select()
                    .single();
                insertedQuote = retry.data;
                quoteInsertError = retry.error;
            }

            if (quoteInsertError) {
                console.error("Database error inserting into supplier_quotations:", quoteInsertError);
                return NextResponse.json(
                    {
                        success: false,
                        error: quoteInsertError.message || "Failed to save quotation.",
                    },
                    { status: 500 }
                );
            }

            resultQuoteId = insertedQuote?.id || null;
        }

        // 5. UPDATE OR INSERT IN SUPPLIERS TABLE (Always synchronize details & products)
        if (matchedSupplier) {
            // Update existing supplier record with products and latest quotation details
            const updatedNotes = matchedSupplier.notes ? `${matchedSupplier.notes} | ${quoteNote}` : quoteNote;

            const updatePayload: Record<string, any> = {
                products: cleanProducts, // ALWAYS update products from submitted quotation
                category: supplierCategory, // ALWAYS update category from submitted quotation
                services_offered: cleanServices, // ALWAYS update services_offered array
                contact_person: contact_person.trim(),
                phone: contact_phone.trim(),
                email: contact_email.trim().toLowerCase(),
                notes: updatedNotes,
                updated_at: new Date().toISOString(),
            };

            if (location && typeof location === "string" && location.trim()) {
                updatePayload.location = location.trim();
            }

            if (matchedPrId) {
                updatePayload.purchase_request_id = matchedPrId;
            }

            const { error: updateSupplierError } = await supabase
                .from("suppliers")
                .update(updatePayload)
                .eq("id", matchedSupplier.id);

            if (updateSupplierError) {
                console.error("Error updating suppliers table:", updateSupplierError);
            } else {
                console.log(`[Supplier Sync] Successfully updated supplier #${matchedSupplier.id} ("${supplier_name}") with products "${cleanProducts}", category "${supplierCategory}", location "${updatePayload.location || matchedSupplier.location}", and services.`);
            }
        } else {
            // Insert new supplier record into suppliers table
            const finalLocation = (location && typeof location === "string" && location.trim()) 
                ? location.trim() 
                : "Metro Manila, Philippines";

            const { data: newSupplier, error: insertSupplierError } = await supabase
                .from("suppliers")
                .insert({
                    name: supplier_name.trim(),
                    category: supplierCategory,
                    contact_person: contact_person?.trim() || "Store Representative",
                    phone: contact_phone?.trim() || "",
                    email: contact_email?.trim()?.toLowerCase() || null,
                    location: finalLocation,
                    products: cleanProducts,
                    services_offered: cleanServices,
                    purchase_request_id: matchedPrId,
                    is_active: false,
                    notes: `Status: Potential / Pending Evaluation | Request ID: ${matchedPrId || request_number || ""} | ${quoteNote}`,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .select("id")
                .maybeSingle();

            if (insertSupplierError) {
                console.error("Error creating new supplier in suppliers table:", insertSupplierError);
            } else if (newSupplier?.id && resultQuoteId) {
                // Link new supplier_id to the quotation record
                await supabase
                    .from("supplier_quotations")
                    .update({ supplier_id: newSupplier.id })
                    .eq("id", resultQuoteId);
                console.log(`[Supplier Sync] Created new supplier #${newSupplier.id} ("${supplier_name}") and linked quotation.`);
            }
        }

        // 6. UPLOAD & RECORD SUPPORTING EVIDENCE IN public.supplier_documents
        const finalSupplierId = matchedSupplier?.id || (resultQuoteId ? (await supabase.from("supplier_quotations").select("supplier_id").eq("id", resultQuoteId).maybeSingle()).data?.supplier_id : null);
        const { documents = [] } = body;
        const uploadedDocsList: any[] = [];

        if (finalSupplierId && Array.isArray(documents) && documents.length > 0) {
            try {
                await supabase.storage.createBucket("supplier_documents", { public: true });
            } catch (bErr) {
                // Bucket already exists
            }

            for (const doc of documents) {
                if (!doc || !doc.file_base64) continue;

                try {
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
                    const safeName = (doc.file_name || `quote_${request_number || "doc"}`).replace(/[^a-zA-Z0-9._-]/g, "_");
                    const storagePath = `suppliers/${finalSupplierId}/${Date.now()}_${safeName}`;

                    const { error: uploadError } = await supabase.storage
                        .from("supplier_documents")
                        .upload(storagePath, fileBuffer, {
                            contentType: mimeType,
                            upsert: true,
                        });

                    if (uploadError) {
                        console.error("[Supplier Documents] Storage upload error:", uploadError);
                    }

                    const { data: publicUrlData } = supabase.storage
                        .from("supplier_documents")
                        .getPublicUrl(storagePath);
                    const fileUrl = publicUrlData?.publicUrl || null;

                    const { data: docRecord, error: docDbError } = await supabase
                        .from("supplier_documents")
                        .insert({
                            supplier_id: finalSupplierId,
                            document_type: doc.document_type || "Supporting Evidence / Quotation Proposal",
                            file_name: doc.file_name || safeName,
                            storage_path: storagePath,
                            file_url: fileUrl,
                            extracted_text: doc.extracted_text || null,
                            extracted_data: doc.extracted_data || null,
                        })
                        .select()
                        .maybeSingle();

                    if (docDbError) {
                        console.error("[Supplier Documents] DB Insert error:", docDbError);
                    } else if (docRecord) {
                        uploadedDocsList.push(docRecord);
                    }
                } catch (docErr) {
                    console.error("[Supplier Documents] Error processing document:", docErr);
                }
            }
        }

        return NextResponse.json({
            success: true,
            isUpdated,
            message: "Quotation recorded successfully, supplier profile synchronized, and documents uploaded.",
            quotationId: resultQuoteId,
            documentsUploaded: uploadedDocsList.length,
            quoteSummary: {
                supplier_name: supplier_name.trim(),
                category: supplierCategory,
                products: cleanProducts,
                services_offered: cleanServices,
                request_number,
                item_name,
                unit_price: Number(unit_price),
                total_amount: Number(total_amount || 0),
            },
        });
    } catch (err: any) {
        console.error("Error in supplier quote submission API:", err);
        return NextResponse.json(
            { success: false, error: err?.message || "Internal server error submitting quotation." },
            { status: 500 }
        );
    }
}
