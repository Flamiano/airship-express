import { Oswald, IBM_Plex_Mono, Inter } from "next/font/google";
import RegisterForm from "@/app/components/RegisterForm";

const display = Oswald({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const monoLabel = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-label",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

export default function RegisterPage() {
  return (
    <main
      className={`${display.variable} ${monoLabel.variable} ${body.variable} relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0B1220]`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(#F2F1EC 1px, transparent 1px), linear-gradient(90deg, #F2F1EC 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <RegisterForm />
    </main>
  );
}