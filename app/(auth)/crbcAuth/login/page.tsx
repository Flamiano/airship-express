import { AuthForm } from "@/app/(crbc)/components/AuthForm"
import { customerServiceLogin as signIn } from "@/app/(crbc)/actions/auth"
import { createClient } from "@/app/(crbc)/library/supabase/server"
import { redirect } from "next/navigation"

export default async function StaffLogin() {
       const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (user) {
        const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();

        if (profile?.role === "staff") {
            redirect("/crbc");
        }
    }

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 relative overflow-hidden">

            {/* overlay */}
            <div
                className="absolute inset-0 pointer-events-none"
               style={{
                    background: `
                        radial-gradient(600px circle at 100% 10%, color-mix(in srgb, var(--color-accent) 12%, transparent), transparent 10%),
                        radial-gradient(600px circle at 1% 10%, color-mix(in srgb, var(--color-accent) 12%, transparent), transparent 10%)
                    `,
                    }}
            />

            <div
                className="absolute inset-0 opacity-[0.4] pointer-events-none"
                style={{
                    backgroundImage: "radial-gradient(circle, var(--color-line) 1px, transparent 1px)",
                    backgroundSize: "24px 24px",
                }}
            />

            <div className="w-full max-w-95 relative z-10">

                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                        <span className="text-muted text-xs font-mono tracking-wide">AIRSHIP</span>
                    </div>
                </div>

                <div className="border border-line bg-paper/60 backdrop-blur-sm rounded-lg">
                    <div className="border-b border-line px-6 py-5">
                        <h1 className="text-foreground text-base font-semibold">Customer Service Sign In</h1>
                    </div>

                    <div className="p-6">
                        <AuthForm action={signIn} />
                    </div>
                </div>

                <div className="flex items-center justify-between mt-4 px-1">
                    <p className="text-muted/70 text-xs">© 2026 Airship</p>
                </div>
            </div>
        </div>
    )
}