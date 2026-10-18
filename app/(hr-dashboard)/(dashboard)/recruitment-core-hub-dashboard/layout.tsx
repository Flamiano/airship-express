"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { label: "Dashboard", href: "/recruitment-core-hub-dashboard/dashboard" },
  { label: "Job Postings", href: "/recruitment-core-hub-dashboard/job-posting" },
  { label: "Manpower Requests", href: "/recruitment-core-hub-dashboard/manpower-requests" },
  { label: "Applicants", href: "/recruitment-core-hub-dashboard/applicants" },
  { label: "Recruitment", href: "/recruitment-core-hub-dashboard/recruitment" },
  { label: "Onboarding", href: "/recruitment-core-hub-dashboard/onboarding" },
  { label: "Employees", href: "/recruitment-core-hub-dashboard/employees" },
  { label: "Reports", href: "/recruitment-core-hub-dashboard/reports" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isDashboard = pathname === "/recruitment-core-hub-dashboard/dashboard";

  return (
    <div className="min-h-screen bg-[#fcfbf9] font-rethink text-[#1c1b1f]">
      {isDashboard && (
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-[#eaeaea] bg-[#fcfbf9] lg:flex lg:flex-col">
          <div className="flex h-16 items-center gap-3 border-b border-[#eaeaea] px-5">
            <Image
              src="/images/logo-remove-bg.png"
              alt="Airship Express"
              width={130}
              height={36}
              priority
              className="h-8 w-auto object-contain"
            />
          </div>

          <div className="shrink-0 px-5 pb-3 pt-4">
            <p className="truncate text-[13px] font-semibold tracking-tight text-[#1c1b1f]">Airship Express</p>
            <p className="mt-1 truncate text-[10.5px] font-medium uppercase tracking-[0.14em] text-[#e5167e]">Recruitment &amp; Employee Records</p>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
            {navigation.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/recruitment-core-hub-dashboard/dashboard" &&
                  pathname.startsWith(`${item.href}/`));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center rounded-lg px-3 py-2.5 text-[13.5px] transition ${active ? "bg-[#e5167e] font-semibold text-white shadow-sm shadow-[#e5167e]/25" : "font-medium text-[#6b6b76] hover:bg-black/[0.04] hover:text-[#1c1b1f]"}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
      )}

      <div className={isDashboard ? "lg:pl-64" : ""}>
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#eaeaea] bg-white/95 px-6 backdrop-blur">
          <div>
            <p className="text-[13px] text-[#6b6b76]">
              Human Resource Department
            </p>
            <h2 className="text-base font-bold tracking-tight text-[#1c1b1f]">
              Recruitment &amp; Employee Records
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {!isDashboard && (
              <Link
                href="/recruitment-core-hub-dashboard/dashboard"
                className="hidden rounded-lg border border-[#eaeaea] bg-white px-3 py-2 text-xs font-semibold text-[#1c1b1f] shadow-sm transition hover:border-[#e5167e] hover:text-[#e5167e] sm:inline-flex"
              >
                ← Dashboard
              </Link>
            )}
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-[#1c1b1f]">
                Super Admin
              </p>
              <p className="text-xs text-[#6b6b76]">
                Administrator
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e5167e] text-sm font-bold text-white">
              SA
            </div>
          </div>
        </header>

        <main className="p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

