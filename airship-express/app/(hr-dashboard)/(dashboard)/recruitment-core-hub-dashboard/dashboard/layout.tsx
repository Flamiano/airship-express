import Image from "next/image";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-gray-200 bg-white lg:flex lg:flex-col">

        {/* Brand */}
        <div className="flex h-20 items-center gap-3 border-b border-gray-100 px-6">
          <Image
            src="/images/logo.jpg"
            alt="Airship Express"
            width={42}
            height={42}
            className="h-10 w-10 object-contain"
          />

          <div>
            <h1 className="text-sm font-bold text-[#1F1F1F]">
              Airship Express
            </h1>

          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4">

          <Link
            href="/dashboard"
            className="flex items-center rounded-lg bg-[#E91E8F]/10 px-4 py-3 text-sm font-semibold text-[#E91E8F]"
          >
            Dashboard
          </Link>

          <Link
            href="/recruitment-core-hub-dashboard/applicants"
            className="flex items-center rounded-lg px-4 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-[#E91E8F]"
          >
            Applicants
          </Link>

          <Link
            href="/recruitment-core-hub-dashboard/recruitment/interviews"
            className="flex items-center rounded-lg px-4 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-[#E91E8F]"
          >
            Recruitment
          </Link>

          <Link
            href="/recruitment-core-hub-dashboard/onboarding"
            className="flex items-center rounded-lg px-4 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-[#E91E8F]"
          >
            Onboarding
          </Link>

          <Link
            href="/recruitment-core-hub-dashboard/employees"
            className="flex items-center rounded-lg px-4 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-[#E91E8F]"
          >
            Employees
          </Link>

          <Link
            href="/recruitment-core-hub-dashboard/reports"
            className="flex items-center rounded-lg px-4 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-[#E91E8F]"
          >
            Reports
          </Link>

        </nav>

      </aside>

      {/* Main */}
      <div className="lg:pl-64">

        {/* Header */}
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-gray-200 bg-white/95 px-6 backdrop-blur">
          <div>
            <p className="text-sm text-gray-500">
              Human Resource Department
            </p>

            <h2 className="text-lg font-bold text-[#1F1F1F]">
              Recruitment & Employee Records
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-[#1F1F1F]">
                Super Admin
              </p>

              <p className="text-xs text-gray-500">
                Administrator
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E91E8F] text-sm font-bold text-white">
              SA
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6 lg:p-8">
          {children}
        </main>

      </div>
    </div>
  );
}