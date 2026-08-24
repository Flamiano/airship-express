"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/app/components/ThemeToggle";
import { useHrAuth } from "../lib/hr-auth";

function roleLabel(role: string): string {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "hr_payroll_admin":
      return "HR Admin";
    default:
      return "Employee";
  }
}

export default function Navbar() {
  const { user, logout } = useHrAuth();
  const router = useRouter();

  async function handleSignOut() {
    await logout();
    router.replace("/hrAuth");
  }

  const initials = user?.fullName
    ? user.fullName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("")
    : "";

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper dark:border-paper/15 dark:bg-ink">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 sm:px-10">
        <Image
          src="/images/logo-remove-bg.png"
          alt="Airship Express"
          width={140}
          height={38}
          className="h-8 w-auto"
          priority
        />
        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-2 text-[12.5px] text-muted sm:flex">
            <span className="h-2 w-2 rounded-full bg-accent" />
            Performance &amp; Development
          </div>
          {user && (
            <div className="flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5 font-rethink text-xs dark:border-paper/15 dark:bg-ink">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/15 text-[10px] font-bold text-accent">
                {initials || "?"}
              </span>
              <span className="hidden max-w-[140px] truncate font-semibold text-ink md:inline dark:text-paper">
                {user.fullName}
              </span>
              <span className="text-muted">· {roleLabel(user.role)}</span>
            </div>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-full border border-line px-3 py-1.5 font-rethink text-xs font-semibold text-muted transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 dark:border-paper/15"
          >
            Sign out
          </button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
