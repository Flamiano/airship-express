"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  HeartHandshake,
  LayoutDashboard,
  MessageSquareText,
  Target,
  TrendingUp,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { useHrAuth } from "../lib/hr-auth";

type NavItem = {
  icon: LucideIcon;
  label: string;
  href: string;
  adminOnly?: boolean;
};

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Overview",
    items: [
      {
        icon: LayoutDashboard,
        label: "Dashboard",
        href: "/performance-development-dashboard",
      },
    ],
  },
  {
    section: "Performance Management",
    items: [
      { icon: Target, label: "Goals", href: "/performance-development-dashboard/goals" },
      {
        icon: ClipboardCheck,
        label: "Appraisals",
        href: "/performance-development-dashboard/appraisals",
      },
      {
        icon: MessageSquareText,
        label: "Feedback",
        href: "/performance-development-dashboard/feedback",
      },
      { icon: TrendingUp, label: "PIP", href: "/performance-development-dashboard/pip" },
    ],
  },
  {
    section: "Development",
    items: [
      {
        icon: Award,
        label: "Competency Management",
        href: "/performance-development-dashboard/competency",
      },
      {
        icon: BookOpen,
        label: "Learning Management",
        href: "/performance-development-dashboard/learning",
      },
      {
        icon: GraduationCap,
        label: "Training Management",
        href: "/performance-development-dashboard/training",
      },
      {
        icon: UserCog,
        label: "Succession Planning",
        href: "/performance-development-dashboard/succession",
        adminOnly: true,
      },
      {
        icon: HeartHandshake,
        label: "Social Recognition",
        href: "/performance-development-dashboard/recognition",
      },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { isAdmin } = useHrAuth();

  return (
    <aside className="w-full shrink-0 border-line sm:w-64 sm:border-r dark:border-paper/15">
      <nav className="flex flex-col gap-5 px-3 py-6">
        {NAV.map((group) => (
          <div key={group.section}>
            <p className="px-3 pb-2 text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
              {group.section}
            </p>
            <div className="flex flex-col gap-1">
              {group.items
                .filter((item) => !item.adminOnly || isAdmin)
                .map(({ icon: Icon, label, href }) => {
                  const active = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                        active
                          ? "bg-ink text-paper dark:bg-paper dark:text-ink"
                          : "text-muted hover:bg-accent/[0.06] hover:text-ink dark:hover:text-paper"
                      }`}
                    >
                      <Icon size={16} strokeWidth={1.75} />
                      {label}
                    </Link>
                  );
                })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
