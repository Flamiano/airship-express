"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Map,
  DollarSign,
  ClipboardList,
  Calendar,
  LogOut,
} from "lucide-react";
import { useShell } from "@/components/ShellContext";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Service Providers", href: "/service-providers", icon: Building2 },
  { label: "Network & Routes", href: "/routes", icon: Map },
  { label: "Rates & Tariffs", href: "/rates", icon: DollarSign },
  { label: "SOPs", href: "/sops", icon: ClipboardList },
  { label: "Schedules", href: "/schedules", icon: Calendar },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarOpen, mounted } = useShell();

  async function handleSignOut() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside
      className={`print-hidden flex h-screen shrink-0 flex-col overflow-hidden border-r border-[#23303D] bg-[#0B1220] transition-all duration-200 ${
        sidebarOpen ? "w-64" : "w-0"
      }`}
    >
      <div className={`flex h-full flex-col overflow-hidden ${sidebarOpen ? "px-4 py-6" : "px-0 py-6"}`}>
        {/* Brand — pinned, never scrolls */}
        <div className="mb-8 flex shrink-0 items-center gap-3 px-2 whitespace-nowrap">
          <img src="/logo.png" alt="Airship Express" className="h-10 w-10 shrink-0 rounded-md object-contain" />
          <div>
            <p className="text-[15px] font-semibold text-[#F2F1EC]" style={{ fontFamily: "var(--font-display)" }}>
              Airship Express
            </p>
            <p className="text-[11px] text-[#8FA0AF]">Network Control Suite</p>
          </div>
        </div>

        {/* Nav — the only part that scrolls if it overflows */}
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto whitespace-nowrap">
          {navItems.map(({ label, href, icon: Icon }) => {
            const active = mounted && !!pathname && pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                suppressHydrationWarning
                className={`flex shrink-0 items-center gap-3 rounded-md px-3 py-2.5 text-sm transition ${
                  active
                    ? "bg-[#3A1229] text-[#F2419B] font-medium"
                    : "text-[#C7D1DA] hover:bg-[#121B26] hover:text-[#F2F1EC]"
                }`}
              >
                <Icon size={18} className="shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Sign out — pinned, never scrolls */}
        <div className="mt-auto shrink-0 border-t border-[#23303D] pt-4 whitespace-nowrap">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-[#F2419B] transition hover:bg-[#3A1229]"
          >
            <LogOut size={18} className="shrink-0" />
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}