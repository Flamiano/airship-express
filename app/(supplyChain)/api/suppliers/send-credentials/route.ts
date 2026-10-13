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
            password,
        } = body;

        if (!email) {
            return NextResponse.json(
                { message: "Email is required" },
                { status: 400 }
            );
        }

        const normalizedEmail = email.trim().toLowerCase();
        const recipientName = contactName?.trim() || supplierName || "Partner";
        const companyName = supplierName || "Supplier Company";

        const result = await provisionSupplierAccount({
            supplierId: supplierId || 0,
            supplierName: companyName,
            contactPerson: recipientName,
            email: normalizedEmail,
            invitedBy: null,
            invitedByName: invitedBy || "Administrator",
            customPassword: password && password.length >= 8 ? password : undefined,
        });

        if (!result.success) {
            return NextResponse.json(
                { ok: false, message: result.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            ok: true,
            emailSent: result.emailSent,
            message: result.emailSent
                ? `Account credentials emailed successfully to ${normalizedEmail}`
                : `Account updated (Email status: ${result.emailError || "Check mailer configuration"})`,
        });
    } catch (err: any) {
        console.error("Error sending supplier credentials email:", err);
        return NextResponse.json(
            { message: "Failed to send email: " + err.message },
            { status: 500 }
        );
    }
}
