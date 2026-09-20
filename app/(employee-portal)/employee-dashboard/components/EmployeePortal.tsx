"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Target, LogOut, ChevronRight } from "lucide-react";
import { supabase } from "@/app/(hr-dashboard)/supabase/client";

type EmployeePortalProps = {
  fullName: string;
  email: string | null;
  accountType: "manager" | "employee";
  employeeIdNumber: string | null;
};

const EMPLOYEE_MODULES = [
  {
    key: "performance-development",
    name: "Performance & Development",
    description:
      "Track goals, competencies, check-ins, and development plans.",
    href: "/performance-development-dashboard",
    icon: Target,
  },
] as const;

export function EmployeePortal({
  fullName,
  email,
  accountType,
  employeeIdNumber,
}: EmployeePortalProps) {
  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/employeeAuth";
  }

  const initials = fullName
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-paper font-rethink text-ink">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-line bg-paper">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <Image
              src="/images/logo-remove-bg.png"
              alt="Airship Express"
              width={130}
              height={36}
              className="h-7 w-auto object-contain"
              priority
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-[13px] font-medium text-ink">{fullName}</p>
              <p className="text-[11px] capitalize text-muted">
                {accountType === "manager" ? "Manager" : "Employee"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-[13px] font-medium text-muted transition-colors hover:bg-accent/[0.06] hover:text-ink"
            >
              <LogOut size={15} strokeWidth={1.75} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          {/* Welcome */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-[13px] font-semibold text-paper">
                {initials}
              </span>
              <div>
                <h1 className="font-bricolage text-[22px] sm:text-[26px] font-medium tracking-tight text-ink">
                  Welcome, {fullName.split(" ")[0]}
                </h1>
                <p className="text-[13px] text-muted">
                  {accountType === "manager"
                    ? "Manager Portal"
                    : "Employee Portal"}
                  {employeeIdNumber && (
                    <span className="ml-2 text-line">·</span>
                  )}
                  {employeeIdNumber && (
                    <span className="ml-2">{employeeIdNumber}</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Modules */}
          <div>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              Your Modules
            </p>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {EMPLOYEE_MODULES.map((mod, i) => {
                const Icon = mod.icon;
                return (
                  <motion.div
                    key={mod.key}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.35,
                      ease: "easeOut",
                      delay: 0.1 + i * 0.06,
                    }}
                  >
                    <Link
                      href={mod.href}
                      className="group flex h-full flex-col rounded-xl border border-line bg-paper p-5 transition-all hover:border-accent hover:shadow-sm hover:shadow-accent/[0.06]"
                    >
                      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/[0.08] text-accent transition-colors group-hover:bg-accent group-hover:text-paper">
                        <Icon size={20} strokeWidth={1.9} />
                      </div>

                      <h3 className="text-[15px] font-semibold text-ink transition-colors group-hover:text-accent">
                        {mod.name}
                      </h3>
                      <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-muted">
                        {mod.description}
                      </p>

                      <div className="mt-4 flex items-center gap-1 text-[12px] font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100">
                        Open
                        <ChevronRight
                          size={13}
                          strokeWidth={2}
                          className="transition-transform group-hover:translate-x-0.5"
                        />
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
