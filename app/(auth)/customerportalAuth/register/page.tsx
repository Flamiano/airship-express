import { AuthForm } from "@/app/(crbc)/components/auth/AuthForm"
import { signUp } from "@/app/(crbc)/actions/auth"
import { redirect } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { getCurrentUser } from "@/app/(crbc)/library/auth/getCurrentUser"

export default async function Register() {
      const user = await getCurrentUser();

          if (user?.customer.role === "customer") {
                 redirect("/customer/dashboard");
             }

    return (
        <div className="min-h-screen bg-background flex">

            {/* left: brand panel */}
            <div className="hidden lg:flex lg:w-[42%] relative bg-accent/5 flex-col p-12 overflow-hidden">
                <svg
                    className="absolute -top-24 -right-24 w-130 h-130 opacity-[0.35] pointer-events-none"
                    viewBox="0 0 520 520" fill="none"
                >
                    <path
                        d="M 20 100 Q 260 460 500 280"
                        stroke="var(--color-accent)" strokeWidth="1.5" strokeDasharray="2 10" strokeLinecap="round"
                    />
                </svg>

                <div className="flex items-center gap-3 relative z-10">
                    <Image src="/images/airship.png" alt="Logo" width={36} height={36} className="h-auto"/>
                    <span className="text-foreground text-lg font-semibold tracking-wide">Airship</span>
                </div>

              <div className="relative z-10 max-w-sm mb-auto mt-auto">
                    <p className="text-foreground text-2xl font-semibold leading-snug">
                        Create your account in a minute.
                    </p>
                    <p className="text-muted text-sm mt-3">
                        Track shipments, view past orders, and get updates as they happen.
                     </p>
                </div>

            </div>

            {/* right: form */}
            <div className="flex-1 flex flex-col items-center justify-center px-4">
                <div className="lg:hidden mb-8 flex items-center gap-3">
                    <Image src="/images/airship.png" alt="Logo" width={36} height={36} className="h-auto"/>
                    <span className="text-foreground text-lg font-semibold tracking-wide">Airship</span>
                </div>

                <div className="w-full max-w-sm">
                    <div className="mb-6">
                        <h1 className="text-foreground text-xl font-semibold">Create an account</h1>
                        <p className="text-muted text-sm mt-1">Sign up to get started</p>
                    </div>

                    <AuthForm action={signUp} isRegister />

                    <p className="text-center text-muted text-xs mt-6">
                        Already have an account?{" "}
                        <Link href="/customerportalAuth/login" className="text-accent hover:text-accent-dark transition-colors font-medium">
                            Sign in
                        </Link>
                    </p>
                </div>

                <p className="lg:hidden text-muted/70 text-xs mt-8">© 2026 Airship. All rights reserved.</p>
            </div>
        </div>
    )
}