import { AuthForm } from "@/app/(crbc)/components/auth/AuthForm"
import { customerLogin as signIn  } from "@/app/(crbc)/actions/auth"
import { redirect } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { getCurrentUser } from "@/app/(crbc)/library/auth/getCurrentUser"

export default async function Login() {
      const user = await getCurrentUser();

         if (user?.customer.role === "customer") {
                redirect("/customer/dashboard");
            }
    return (
        <div className="min-h-screen bg-background flex">

            {/* left: brand panel */}
            <div className="hidden lg:flex lg:w-[42%] relative bg-accent/5 flex-col p-12 overflow-hidden">
                <svg
                    className="absolute -bottom-24 -left-24 w-130 h-130 opacity-[0.35] pointer-events-none"
                    viewBox="0 0 520 520" fill="none"
                >
                    <path
                        d="M 20 420 Q 260 60 500 240"
                        stroke="var(--color-accent)" strokeWidth="1.5" strokeDasharray="2 10" strokeLinecap="round"
                    />
                </svg>

                <div className="flex items-center gap-3 relative z-10">
                    <Image src="/images/airship.png" alt="Logo" width={36} height={36} className="h-auto"/>
                    <span className="text-foreground text-lg font-semibold tracking-wide">Airship</span>
                </div>

             <div className="relative z-10 max-w-sm mb-auto mt-auto">
                <p className="text-foreground text-2xl font-semibold leading-snug">
                    Your shipment, tracked every step of the way.
                </p>
                <p className="text-muted text-sm mt-3">
                    Track orders, view your history, and reach support without the back-and-forth.
                </p>
            </div>

            </div>

            <div className="flex-1 flex flex-col items-center justify-center px-4">
                <div className="lg:hidden mb-8 flex items-center gap-3">
                    <Image src="/images/airship.png" alt="Logo" width={36} height={36} className="h-auto"/>
                    <span className="text-foreground text-lg font-semibold tracking-wide">Airship</span>
                </div>

                <div className="w-full max-w-sm">
                    <div className="mb-6">
                        <h1 className="text-foreground text-xl font-semibold">Welcome back</h1>
                        <p className="text-muted text-sm mt-1">Sign in to your account</p>
                    </div>

                    <AuthForm action={signIn} />

                    <p className="text-center text-muted text-xs mt-6">
                        Don&#39;t have an account?{" "}
                        <Link href="/customerportalAuth/register" className="text-accent hover:text-accent-dark transition-colors font-medium">
                            Sign up
                        </Link>
                    </p>
                </div>

            </div>
        </div>
    )
}