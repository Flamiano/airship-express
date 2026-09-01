"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Building2,
  Map,
  DollarSign,
  ClipboardList,
  Calendar,
  Loader2,
} from "lucide-react";
import { useShell } from "@/components/ShellContext";
import PageHeader from "@/components/PageHeader";

const modules = [
  { title: "Service Providers", desc: "Carriers, forwarders & vendors", icon: Building2, bg: "bg-[#12203A]", color: "text-[#5B8CF2]", lightBg: "bg-[#E4ECFC]", lightColor: "text-[#3B6BE0]", href: "/service-providers" },
  { title: "Network & Routes", desc: "Origin-destination planning", icon: Map, bg: "bg-[#0F2E22]", color: "text-[#3BD68A]", lightBg: "bg-[#E1F7EC]", lightColor: "text-[#1FA968]", href: "/routes" },
  { title: "Rates & Tariffs", desc: "Pricing & validity", icon: DollarSign, bg: "bg-[#3A2A0F]", color: "text-[#F2A23B]", lightBg: "bg-[#FDF0DD]", lightColor: "text-[#C9791A]", href: "/rates" },
  { title: "SOPs", desc: "Standard operating procedures", icon: ClipboardList, bg: "bg-[#2A123A]", color: "text-[#B25BF2]", lightBg: "bg-[#F3E7FC]", lightColor: "text-[#9A3BE0]", href: "/sops" },
  { title: "Schedules", desc: "Upcoming departures", icon: Calendar, bg: "bg-[#0F2A33]", color: "text-[#3BC6E8]", lightBg: "bg-[#DFF4FA]", lightColor: "text-[#1B9FC2]", href: "/schedules" },
];

const userFullName = "ADMIN"; // TODO: replace with real session user's full_name

const getArrayLength = (payload: unknown, key: string) => {
  if (payload && typeof payload === "object" && key in payload) {
    const value = (payload as Record<string, unknown>)[key];
    return Array.isArray(value) ? value.length : 0;
  }

  return Array.isArray(payload) ? payload.length : 0;
};

export default function DashboardPage() {
  const { theme } = useShell();
  const isDark = theme === "dark";

  const [providerCount, setProviderCount] = useState<number | null>(null);
  const [routeCount, setRouteCount] = useState<number | null>(null);
  const [rateCount, setRateCount] = useState<number | null>(null);
  const [scheduleCount, setScheduleCount] = useState<number | null>(null);
  const [sopCount, setSopCount] = useState<number | null>(null);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  useEffect(() => {
    fetch("/api/service-providers", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setProviderCount(getArrayLength(data, "providers")))
      .catch(() => setProviderCount(0));

    fetch("/api/routes", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setRouteCount(getArrayLength(data, "routes")))
      .catch(() => setRouteCount(0));

    fetch("/api/rates", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setRateCount(getArrayLength(data, "rates")))
      .catch(() => setRateCount(0));

    fetch("/api/schedules", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setScheduleCount(getArrayLength(data, "schedules")))
      .catch(() => setScheduleCount(0));

    fetch("/api/sops", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setSopCount(getArrayLength(data, "sops")))
      .catch(() => setSopCount(0));
  }, []);

  const isLoading =
    providerCount === null ||
    routeCount === null ||
    rateCount === null ||
    scheduleCount === null ||
    sopCount === null;

  const stats = [
    { label: "Service Providers", value: providerCount ?? "…", icon: Building2, bg: "bg-[#12203A]", color: "text-[#5B8CF2]", lightBg: "bg-[#E4ECFC]", lightColor: "text-[#3B6BE0]" },
    { label: "Routes", value: routeCount ?? "…", icon: Map, bg: "bg-[#0F2E22]", color: "text-[#3BD68A]", lightBg: "bg-[#E1F7EC]", lightColor: "text-[#1FA968]" },
    { label: "Rates", value: rateCount ?? "…", icon: DollarSign, bg: "bg-[#3A2A0F]", color: "text-[#F2A23B]", lightBg: "bg-[#FDF0DD]", lightColor: "text-[#C9791A]" },
   { label: "SOPs", value: sopCount ?? "…", icon: ClipboardList, bg: "bg-[#2A123A]", color: "text-[#B25BF2]", lightBg: "bg-[#F3E7FC]", lightColor: "text-[#9A3BE0]" },
    { label: "Schedules", value: scheduleCount ?? "…", icon: Calendar, bg: "bg-[#0F2A33]", color: "text-[#3BC6E8]", lightBg: "bg-[#DFF4FA]", lightColor: "text-[#1B9FC2]" },
  ];

  return (
    <div className={`min-h-full pb-8 ${isDark ? "bg-[#0B1220]" : "bg-white"}`}>
      <PageHeader
        icon={<LayoutDashboard size={20} />}
        title={userFullName}
        subtitle={`Network Control overview · ${today}`}
        showThemeToggle
      />

      <div className="px-8">
        {isLoading ? (
          <div className="mb-10 flex flex-col items-center gap-3 py-16">
            <Loader2 size={32} className="animate-spin text-[#F2419B]" />
            <p className="text-sm font-semibold text-[#F2419B]">Loading</p>
          </div>
        ) : (
          <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {stats.map(({ label, value, icon: Icon, bg, color, lightBg, lightColor }) => (
              <div
                key={label}
                className={`rounded-lg border p-5 transition-colors ${
                  isDark
                    ? "border-[#2C4356] bg-[#121B26] hover:border-[#3A4C5E]"
                    : "border-gray-300 bg-gray-50 hover:border-gray-400"
                }`}
              >
                <div
                  className={`mb-4 flex h-10 w-10 items-center justify-center rounded-md ${
                    isDark ? `${bg} ${color}` : `${lightBg} ${lightColor}`
                  }`}
                >
                  <Icon size={20} />
                </div>
                <p
                  className={`text-3xl font-bold ${isDark ? "text-[#F2F1EC]" : "text-gray-900"}`}
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {value}
                </p>
                <p className={`mt-1 text-sm font-bold ${isDark ? "text-[#8FA0AF]" : "text-gray-700"}`}>{label}</p>
              </div>
            ))}
          </div>
        )}

        <p
          className={`mb-4 text-[11px] font-medium tracking-[0.2em] uppercase ${
            isDark ? "text-[#8FA0AF]" : "text-gray-500"
          }`}
          style={{ fontFamily: "var(--font-mono-label)" }}
        >
          Subsystem Modules
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {modules.map(({ title, desc, icon: Icon, bg, color, lightBg, lightColor, href }) => (
            <Link
              key={title}
              href={href}
              suppressHydrationWarning
              className={`flex flex-col items-start rounded-lg border p-5 text-left transition ${
                isDark
                  ? "border-[#23303D] bg-[#121B26] hover:border-[#F2A23B]/40 hover:bg-[#16212E]"
                  : "border-gray-200 bg-gray-50 hover:border-[#F2419B]/60 hover:bg-gray-100"
              }`}
            >
              <div
                className={`mb-4 flex h-10 w-10 items-center justify-center rounded-md ${
                  isDark ? `${bg} ${color}` : `${lightBg} ${lightColor}`
                }`}
              >
                <Icon size={20} />
              </div>
              <p
                className={`text-base font-semibold ${isDark ? "text-[#F2F1EC]" : "text-gray-900"}`}
                style={{ fontFamily: "var(--font-display)" }}
              >
                {title}
              </p>
              <p className={`mt-1 text-sm ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>{desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}