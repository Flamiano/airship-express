"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Award,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  HeartHandshake,
  MessageSquareText,
  Target,
  TrendingUp,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import PageHeader from "@/app/(hr-dashboard)/performance-development-dashboard/components/PageHeader";
import Card from "@/app/(hr-dashboard)/performance-development-dashboard/components/Card";
import AiInsights from "@/app/(hr-dashboard)/performance-development-dashboard/components/AiInsights";
import {
  fadeUp,
  staggerContainer,
  staggerItem,
} from "@/app/(hr-dashboard)/performance-development-dashboard/components/motion";
import { useHrAuth } from "@/app/(hr-dashboard)/performance-development-dashboard/lib/hr-auth";

type ModuleCard = {
  icon: LucideIcon;
  label: string;
  description: string;
  href: string;
};

const COMMON_MODULES: ModuleCard[] = [
  {
    icon: Target,
    label: "Goals",
    description:
      "Track your objectives, update progress, and keep your manager in the loop.",
    href: "/performance-development-dashboard/goals",
  },
  {
    icon: MessageSquareText,
    label: "Continuous Feedback",
    description:
      "Share regular feedback — praise, coaching, or improvement notes — anytime.",
    href: "/performance-development-dashboard/feedback",
  },
  {
    icon: TrendingUp,
    label: "Performance Improvement Plans",
    description:
      "A structured plan to support an employee in getting back on track.",
    href: "/performance-development-dashboard/pip",
  },
  {
    icon: BookOpen,
    label: "Learning Management",
    description: "Browse the course catalog, enroll, and track progress.",
    href: "/performance-development-dashboard/learning",
  },
  {
    icon: GraduationCap,
    label: "Training Management",
    description:
      "Onboard new staff, schedule sessions, and record who actually attended.",
    href: "/performance-development-dashboard/training",
  },
  {
    icon: HeartHandshake,
    label: "Social Recognition",
    description:
      "Acknowledge good work across the team — everyone can be recognized.",
    href: "/performance-development-dashboard/recognition",
  },
];

const ADMIN_MODULES: ModuleCard[] = [
  {
    icon: ClipboardCheck,
    label: "Performance Management",
    description:
      "Managers rate performance across key areas and finalize each review period.",
    href: "/performance-development-dashboard/appraisals",
  },
  {
    icon: Award,
    label: "Competency Management",
    description:
      "Assess skill levels, spot gaps, and manage the competency library.",
    href: "/performance-development-dashboard/competency",
  },
  {
    icon: UserCog,
    label: "Succession Planning",
    description:
      "Track readiness for critical roles so the company is never caught short.",
    href: "/performance-development-dashboard/succession",
  },
];

function ModuleGrid({ modules }: { modules: ModuleCard[] }) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="shown"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {modules.map(({ icon: Icon, label, description, href }) => (
        <motion.div key={href} variants={staggerItem}>
          <Link
            href={href}
            className="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <Card className="h-full p-5 transition-colors group-hover:border-accent/40 group-focus-visible:border-accent/40">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent">
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-[12px] font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  Open →
                </p>
              </div>
              <h2 className="mt-4 font-bricolage text-[15px] font-semibold tracking-tight">
                {label}
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                {description}
              </p>
            </Card>
          </Link>
        </motion.div>
      ))}
    </motion.div>
  );
}

export default function DashboardPage() {
  const { user, isAdmin } = useHrAuth();
  const firstName = user?.fullName.split(" ")[0] ?? "there";

  return (
    <div>
      <motion.div variants={fadeUp} initial="hidden" animate="shown">
        <PageHeader
          eyebrow="Performance & Development"
          title={`Welcome, ${firstName}.`}
          subtitle={`${user?.jobTitle ?? user?.role.replace("_", " ") ?? "dashboard"} — here's what's happening across your team.`}
        />
      </motion.div>

      <ModuleGrid modules={COMMON_MODULES} />

      {isAdmin && (
        <section className="mt-12">
          <h2 className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
            Administration
          </h2>
          <div className="mt-4">
            <ModuleGrid modules={ADMIN_MODULES} />
          </div>
        </section>
      )}

      <AiInsights />
    </div>
  );
}
