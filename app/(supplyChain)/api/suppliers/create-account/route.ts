import { NextResponse } from "next/server";
import { provisionSupplierAccount } from "../../../lib/services/supplierAccountService";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            supplierId,
            supplierName,
            contactName,
            email,
            invitedBy,
            invitedByName
        } = body;

        if (!supplierId || !email || !contactName) {
            return NextResponse.json(
                { ok: false, message: "Missing required supplier fields (supplierId, email, contactName)" },
                { status: 400 }
            );
        }

        const normalizedEmail = email.trim().toLowerCase();
        const trimmedContactName = contactName.trim();
        const companyName = supplierName || "Supplier Company";

        const result = await provisionSupplierAccount({
            supplierId,
            supplierName: companyName,
            contactPerson: trimmedContactName,
            email: normalizedEmail,
            invitedBy,
            invitedByName: invitedByName || "Administrator",
        });

        if (!result.success) {
            return NextResponse.json(
                { ok: false, message: result.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            ok: true,
            data: {
                supplier_id: supplierId,
                email: normalizedEmail,
                contact_name: trimmedContactName,
                status: "Active",
            },
            emailSent: result.emailSent,
            emailError: result.emailError,
            message: result.emailSent
                ? `Account registered in Users table and credentials emailed to ${normalizedEmail}`
                : `Account created in Users table (Email status: ${result.emailError || "Check mailer configuration"})`,
        });
    } catch (error: any) {
        console.error("Supplier creation API error:", error);
        return NextResponse.json(
            { ok: false, message: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
