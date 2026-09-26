import { redirect } from "next/navigation";
import { createClient } from "../supabase/server";

type RequiredRole = "customer" | "staff";

export async function protectRoute(
    requiredRole: RequiredRole,
    table: "customers" | "profiles"
) {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect(
            requiredRole === "staff"
                ? "/crbcAuth/login"
                : "/customerportalAuth/login"
        );
    }

    const { data: profile, error } = await supabase
        .from(table)
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

    if (error || !profile) {
        if (requiredRole === "staff") {
            redirect("/crbcAuth/login");
        }

        redirect("/crbc");
    }

    // Wrong role
    if (profile.role !== requiredRole) {
        if (profile.role === "staff") {
            redirect("/crbc");
        }

        if (profile.role === "customer") {
            redirect("/customer/dashboard");
        }

        redirect(
            requiredRole === "staff"
                ? "/crbcAuth/login"
                : "/customerportalAuth/login"
        );
    }

    return {
        user,
        profile,
    };
}