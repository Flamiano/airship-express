import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "crypto";
import { sendSupplyChainEmail } from "../email/mailer";

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

/**
 * Generates a strong, compliant auto-generated password
 * Format: Airship#<random4><digit><special> (e.g. Airship#9kL$2w)
 */
export function generateSecureSupplierPassword(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    const digits = "23456789";
    const specials = "!@#$%&*";

    let randomPart = "";
    for (let i = 0; i < 4; i++) {
        randomPart += chars[Math.floor(Math.random() * chars.length)];
    }
    const randomDigit = digits[Math.floor(Math.random() * digits.length)];
    const randomSpecial = specials[Math.floor(Math.random() * specials.length)];

    return `Airship#${randomPart}${randomDigit}${randomSpecial}`;
}

export interface ProvisionSupplierAccountParams {
    supplierId: number | string;
    supplierName: string;
    contactPerson?: string;
    email: string;
    phone?: string;
    invitedBy?: string | null;
    invitedByName?: string;
    customPassword?: string;
}

export interface ProvisionSupplierAccountResult {
    success: boolean;
    userId?: string;
    email: string;
    password?: string;
    emailSent: boolean;
    emailError?: string | null;
    message: string;
}

/**
 * Automatically provisions a supplier account directly in:
 * 1. Supabase Auth (auth.users)
 * 2. public.users table (role: 'Supplier', status: 'Active')
 * 3. public.suppliers_account table
 * And immediately emails login credentials through Gmail SMTP.
 */
export async function provisionSupplierAccount(
    params: ProvisionSupplierAccountParams
): Promise<ProvisionSupplierAccountResult> {
    const {
        supplierId,
        supplierName,
        contactPerson,
        email,
        invitedBy,
        invitedByName,
        customPassword,
    } = params;

    if (!email || !email.trim()) {
        return {
            success: false,
            email: "",
            emailSent: false,
            emailError: "No email address provided for supplier account provisioning",
            message: "Supplier record saved, but no email provided for account creation.",
        };
    }

    const normalizedEmail = email.trim().toLowerCase();
    const companyName = supplierName?.trim() || "Supplier Company";
    const repName = contactPerson?.trim() || companyName;
    const password = customPassword || generateSecureSupplierPassword();

    let userId: string | null = null;

    try {
        // 1. Check if user already exists in Supabase Auth
        const { data: authList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        const existingAuthUser = authList?.users?.find(
            (u) => u.email?.toLowerCase() === normalizedEmail
        );

        if (existingAuthUser) {
            userId = existingAuthUser.id;
            // Update auth user with new password & metadata
            const { error: updateAuthErr } = await supabaseAdmin.auth.admin.updateUserById(
                userId,
                {
                    password: password,
                    email_confirm: true,
                    user_metadata: {
                        display_name: repName,
                        role: "Supplier",
                        supplier_id: supplierId,
                    },
                }
            );
            if (updateAuthErr) {
                console.warn("Notice updating existing auth user password:", updateAuthErr);
            }
        } else {
            // Create new Supabase Auth user
            const { data: createdAuth, error: createAuthErr } = await supabaseAdmin.auth.admin.createUser({
                email: normalizedEmail,
                password: password,
                email_confirm: true,
                user_metadata: {
                    display_name: repName,
                    role: "Supplier",
                    supplier_id: supplierId,
                },
            });

            if (createAuthErr) {
                console.error("Error creating auth user:", createAuthErr);
                // If already registered, fetch from users table
                const { data: existingUserDb } = await supabaseAdmin
                    .from("users")
                    .select("id")
                    .ilike("email", normalizedEmail)
                    .maybeSingle();
                userId = existingUserDb?.id || null;
            } else {
                userId = createdAuth?.user?.id || null;
            }
        }

        if (!userId) {
            // Fallback UUID if auth listing failed
            const { data: existingUserDb } = await supabaseAdmin
                .from("users")
                .select("id")
                .ilike("email", normalizedEmail)
                .maybeSingle();
            userId = existingUserDb?.id || randomUUID();
        }

        // 2. Insert or update in public.users table directly
        const { error: userUpsertErr } = await supabaseAdmin
            .from("users")
            .upsert(
                {
                    id: userId,
                    email: normalizedEmail,
                    display_name: repName,
                    role: "Supplier",
                    position: "Authorized Supplier Representative",
                    department: companyName,
                    status: "Active",
                    updated_at: new Date().toISOString(),
                },
                { onConflict: "email" }
            );

        if (userUpsertErr) {
            console.error("Error upserting to users table:", userUpsertErr);
        }

        // 3. Upsert into public.suppliers_account table
        const { error: suppAccErr } = await supabaseAdmin
            .from("suppliers_account")
            .upsert(
                {
                    supplier_id: Number(supplierId),
                    email: normalizedEmail,
                    contact_name: repName,
                    status: "Active",
                    invited_by: invitedBy || null,
                    invited_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                },
                { onConflict: "email" }
            );

        if (suppAccErr) {
            console.warn("Notice upserting to suppliers_account:", suppAccErr);
        }

        // 4. Record notification & user activity
        try {
            await supabaseAdmin.from("notifications").insert([
                {
                    creator_name: invitedByName || "System Administrator",
                    creator_email: "procurement@airshipexpress.ph",
                    title: "Supplier Account Provisioned",
                    message: `Supplier Portal account created for ${companyName} (${normalizedEmail}) with role Supplier.`,
                    role: ["Admin", "Executive"],
                    type: "supplier_account",
                    link: "/suppliers",
                    is_read: false,
                    created_at: new Date().toISOString(),
                },
            ]);

            if (invitedBy) {
                await supabaseAdmin.from("user_activity").insert({
                    user_id: invitedBy,
                    action: "SUPPLIER_ACCOUNT_AUTO_PROVISIONED",
                    module: "Suppliers",
                    description: `Account auto-provisioned for ${companyName} (${normalizedEmail}) with auto-generated credentials.`,
                    created_at: new Date().toISOString(),
                });
            }
        } catch (notifErr) {
            console.warn("Activity/Notification log notice:", notifErr);
        }

        // 5. Send Email through Gmail SMTP with direct login credentials
        let emailSent = false;
        let emailError: string | null = null;

        try {
            const appUrl = (
                process.env.NEXT_PUBLIC_APP_URL || 
                process.env.NEXT_PUBLIC_SUPPLYCHAIN_APP_URL || 
                "http://sc.localhost:3000"
            ).replace(/\/+$/, "");
            const loginUrl = `${appUrl}/scAuth`;

            const emailHtml = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Supplier Portal Account Credentials</title>
            </head>
            <body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #1e293b;">
                <div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #fff; opacity: 0;">
                    Your Airship Express Supplier Portal account has been activated. Sign in directly with your email and password.
                </div>

                <div style="max-width: 600px; margin: 0 auto; padding: 32px 24px; background-color: #ffffff; color: #1e293b; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                    <!-- Brand Banner -->
                    <div style="text-align: center; margin-bottom: 24px;">
                        <span style="display: inline-block; background-color: #db2777; color: #ffffff; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                            Airship Express Supply Chain
                        </span>
                        <h1 style="color: #0f172a; font-size: 24px; font-weight: 800; margin: 4px 0 0;">Supplier Account Activated</h1>
                        <p style="color: #64748b; font-size: 13px; margin-top: 4px; font-weight: 500;">Authorized Procurement & Partner Network</p>
                    </div>

                    <!-- Welcome Note -->
                    <div style="background-color: #fdf2f8; border: 1px solid #fbcfe8; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
                        <h2 style="color: #9d174d; font-size: 16px; font-weight: 700; margin: 0 0 6px 0;">Welcome, ${repName}!</h2>
                        <p style="color: #475569; font-size: 14px; line-height: 1.5; margin: 0;">
                            Your Supplier Portal account for <strong>${companyName}</strong> is now active. You have direct access to your purchase orders, dispatch tracking, RFQ submissions, and direct procurement messaging.
                        </p>
                    </div>

                    <!-- Direct Credentials Card -->
                    <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                        <div style="display: flex; align-items: center; margin-bottom: 14px;">
                            <span style="background-color: #059669; color: #ffffff; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px; margin-right: 8px; text-transform: uppercase;">Direct Login Access</span>
                            <strong style="font-size: 13px; color: #0f172a;">Your Account Credentials</strong>
                        </div>
                        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                            <tr>
                                <td style="padding: 8px 0; color: #64748b; width: 140px; font-size: 13px;">Login Portal:</td>
                                <td style="padding: 8px 0;">
                                    <a href="${loginUrl}" style="color: #db2777; font-weight: 700; text-decoration: none; font-family: monospace;">${loginUrl}</a>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Email Address:</td>
                                <td style="padding: 8px 0; font-weight: 700; color: #0f172a; font-family: monospace;">${normalizedEmail}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Auto Password:</td>
                                <td style="padding: 8px 0;">
                                    <span style="font-family: SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 15px; font-weight: 800; color: #db2777; background-color: #fce7f3; padding: 4px 10px; border-radius: 6px; display: inline-block; border: 1px solid #fbcfe8;">${password}</span>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Assigned Role:</td>
                                <td style="padding: 8px 0; font-weight: 700; color: #0f172a;">Supplier</td>
                            </tr>
                        </table>
                    </div>

                    <!-- Direct Access CTA -->
                    <div style="text-align: center; margin: 28px 0;">
                        <a href="${loginUrl}" style="background-color: #db2777; color: #ffffff; padding: 14px 36px; border-radius: 9999px; text-decoration: none; font-weight: 800; font-size: 14px; display: inline-block; box-shadow: 0 4px 14px rgba(219, 39, 119, 0.35);">Sign In to Supplier Portal</a>
                    </div>

                    <!-- Instructions -->
                    <div style="margin-bottom: 24px; padding: 16px; background-color: #f1f5f9; border-radius: 12px;">
                        <p style="font-size: 12px; color: #475569; margin: 0; line-height: 1.6;">
                            <strong>Note:</strong> You can log in directly using your email and generated password above. Once logged in, you can update your password at any time from your profile settings.
                        </p>
                    </div>

                    <!-- Footer -->
                    <div style="border-top: 1px solid #e2e8f0; padding-top: 18px; text-align: center; color: #94a3b8; font-size: 12px; line-height: 1.5;">
                        <p style="margin: 0 0 4px 0;">Airship Express Inc. • Procurement & Supplier Management</p>
                        <p style="margin: 0;">Authorized by ${invitedByName || "Procurement Operations"}</p>
                    </div>
                </div>
            </body>
            </html>
            `;

            const plainText = `Airship Express Supplier Portal Account Activated\n\nHello ${repName},\nYour Supplier Portal account for ${companyName} has been activated.\n\nLOGIN CREDENTIALS:\nLogin URL: ${loginUrl}\nEmail: ${normalizedEmail}\nPassword: ${password}\nRole: Supplier\n\nYou can sign in directly at the Supply Chain Portal.\n\nAuthorized by: ${invitedByName || "Procurement Operations"}`;

            const emailResult = await sendSupplyChainEmail({
                to: normalizedEmail,
                subject: `[Airship Express] Supplier Portal Account Activated: ${companyName}`,
                html: emailHtml,
                text: plainText,
                senderName: "Airship Express Supply Chain",
            });

            emailSent = emailResult.success;
        } catch (mailErr: any) {
            console.error("Error sending supplier credentials email:", mailErr);
            emailError = mailErr?.message || "Failed to dispatch email";
        }

        return {
            success: true,
            userId: userId || undefined,
            email: normalizedEmail,
            password: password,
            emailSent,
            emailError,
            message: emailSent
                ? `Account created and login credentials emailed to ${normalizedEmail}`
                : `Account created in database (Email notification: ${emailError || "Check SMTP settings"})`,
        };
    } catch (err: any) {
        console.error("Failed to provision supplier account:", err);
        return {
            success: false,
            email: normalizedEmail,
            emailSent: false,
            emailError: err?.message || "Failed to provision account",
            message: "Error provisioning supplier account: " + (err?.message || "Unknown error"),
        };
    }
}
