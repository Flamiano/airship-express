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
        const supplierName = searchParams.get("supplier_name");
        const quotationId = searchParams.get("quotation_id");

        let resolvedSupId = supplierId ? Number(supplierId) : null;

        // If quotationId provided, resolve supplier_id from quotation
        if (!resolvedSupId && quotationId) {
            const { data: quote } = await supabaseAdmin
                .from("supplier_quotations")
                .select("supplier_id")
                .eq("id", Number(quotationId))
                .maybeSingle();
            if (quote?.supplier_id) {
                resolvedSupId = Number(quote.supplier_id);
            }
        }

        // If supplierName provided, resolve supplier_id
        if (!resolvedSupId && supplierName) {
            const cleanName = supplierName.split(" - ")[0].split(" (")[0].trim();
            const { data: supRows } = await supabaseAdmin
                .from("suppliers")
                .select("id")
                .ilike("name", `%${cleanName}%`)
                .limit(1);
            if (supRows && supRows.length > 0) {
                resolvedSupId = supRows[0].id;
            }
        }

        let query = supabaseAdmin
            .from("supplier_documents")
            .select("*")
            .order("created_at", { ascending: false });

        if (resolvedSupId) {
            query = query.eq("supplier_id", resolvedSupId);
        }

        const { data: dbDocs, error: dbError } = await query;
        if (dbError) throw dbError;

        // Fetch suppliers to enrich document objects
        const { data: suppliersList } = await supabaseAdmin
            .from("suppliers")
            .select("id, name, category, contact_person, email, phone");

        const supplierMap = new Map((suppliersList || []).map((s) => [Number(s.id), s]));

        const formattedDocs = (dbDocs || []).map((doc) => {
            let publicUrl = doc.file_url || "";
            if (!publicUrl && doc.storage_path) {
                const { data: pData } = supabaseAdmin.storage
                    .from("supplier_documents")
                    .getPublicUrl(doc.storage_path);
                publicUrl = pData?.publicUrl || "";
            }

            const matchedSup = supplierMap.get(Number(doc.supplier_id));
            const fileName = doc.file_name || "Document Attachment";
            const isPdf = fileName.toLowerCase().endsWith(".pdf");
            const isImg = /\.(png|jpe?g|webp|gif|svg)$/i.test(fileName);

            return {
                id: String(doc.id),
                supplierId: doc.supplier_id,
                supplierName: matchedSup?.name || (doc.supplier_id ? `Supplier #${doc.supplier_id}` : "Unassigned Supplier"),
                supplierCategory: matchedSup?.category || "General",
                supplierContact: matchedSup?.contact_person || "",
                supplierEmail: matchedSup?.email || "",
                supplierPhone: matchedSup?.phone || "",
                fileName,
                fileType: isPdf ? "application/pdf" : isImg ? "image/png" : "application/octet-stream",
                fileSize: 102400,
                documentType: doc.document_type || "Contract / Document",
                storagePath: doc.storage_path,
                fileUrl: publicUrl,
                publicUrl,
                extractedText: doc.extracted_text || null,
                extractedData: doc.extracted_data || null,
                summary: doc.extracted_data?.document_summary || undefined,
                createdAt: doc.created_at,
                uploadedBy: doc.uploaded_by || null,
            };
        });

        return NextResponse.json({
            success: true,
            documents: formattedDocs,
            count: formattedDocs.length,
            supplierId: resolvedSupId,
        });
    } catch (error: any) {
        console.error("[Supplier Documents API] GET Error:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to fetch documents." },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const supplierId = formData.get("supplier_id") ? Number(formData.get("supplier_id")) : null;
        const documentType = (formData.get("document_type") as string) || "Contract";
        const file = formData.get("file") as File | null;
        const uploadedBy = (formData.get("uploaded_by") as string) || "Supply Chain Admin";

        if (!supplierId) {
            return NextResponse.json(
                { success: false, error: "Supplier ID is required." },
                { status: 400 }
            );
        }

        if (!file) {
            return NextResponse.json(
                { success: false, error: "Document file is required." },
                { status: 400 }
            );
        }

        // Ensure storage bucket exists
        try {
            await supabaseAdmin.storage.createBucket("supplier_documents", { public: true });
        } catch {
            // ignore if exists
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = `suppliers/${supplierId}/${Date.now()}_${safeFileName}`;

        const { error: uploadError } = await supabaseAdmin.storage
            .from("supplier_documents")
            .upload(storagePath, buffer, {
                contentType: file.type || "application/octet-stream",
                upsert: true,
            });

        if (uploadError) {
            throw uploadError;
        }

        const { data: pData } = supabaseAdmin.storage
            .from("supplier_documents")
            .getPublicUrl(storagePath);

        const fileUrl = pData?.publicUrl || "";

        const { data: newDoc, error: insertError } = await supabaseAdmin
            .from("supplier_documents")
            .insert({
                supplier_id: supplierId,
                document_type: documentType,
                file_name: file.name,
                storage_path: storagePath,
                file_url: fileUrl,
                uploaded_by: uploadedBy,
                extracted_data: {
                    file_size: file.size,
                    file_type: file.type,
                },
            })
            .select()
            .single();

        if (insertError) {
            throw insertError;
        }

        return NextResponse.json({
            success: true,
            message: "Document uploaded successfully.",
            document: newDoc,
        });
    } catch (error: any) {
        console.error("[Supplier Documents API] POST Error:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to upload document." },
            { status: 500 }
        );
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const docId = searchParams.get("id");

        if (!docId) {
            return NextResponse.json(
                { success: false, error: "Document ID is required." },
                { status: 400 }
            );
        }

        // Fetch document to obtain storage_path
        const { data: doc } = await supabaseAdmin
            .from("supplier_documents")
            .select("storage_path")
            .eq("id", docId)
            .maybeSingle();

        if (doc?.storage_path) {
            try {
                await supabaseAdmin.storage
                    .from("supplier_documents")
                    .remove([doc.storage_path]);
            } catch (err) {
                console.warn("Could not delete file from storage bucket:", err);
            }
        }

        const { error: deleteError } = await supabaseAdmin
            .from("supplier_documents")
            .delete()
            .eq("id", docId);

        if (deleteError) {
            throw deleteError;
        }

        return NextResponse.json({
            success: true,
            message: "Document deleted successfully.",
        });
    } catch (error: any) {
        console.error("[Supplier Documents API] DELETE Error:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to delete document." },
            { status: 500 }
        );
    }
}
