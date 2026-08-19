// app/(supplyChain)/page.tsx
import Cards from '@/app/(supplyChain)/components/global/Cards';
import { DownloadBtn } from "@/app/(supplyChain)/components/global/Buttons";
import AiQuestions from "@/app/(supplyChain)/components/global/AiQuestions";
import { SessionGuard } from '@/app/(supplyChain)/components/server/SessionGuard';
import ExecutiveCharts from '@/app/(supplyChain)/(pages)/executive/components/ExecutiveCharts';

export default function Home() {
  return (
    <SessionGuard requiredRole={['Admin', 'Executive']}>
      <div className="p-4 sm:p-6 space-y-6 fade-in bgCard dark:bg-[#2a2a2e]">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-pink-50 dark:bg-pink-950/20 border border-pink-100 dark:border-pink-800/30 flex items-center justify-center text-pink-600 dark:text-pink-400 text-lg shadow-2xs shrink-0">
              <i className="fas fa-chart-line"></i>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Executive Overview
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Real-time snapshot of parcel flow, operations, procurement, and fleet.
              </p>
            </div>
          </div>

          <div className="shrink-0 self-stretch sm:self-auto flex items-center justify-end">
            <DownloadBtn />
          </div>
        </div>

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Cards
            header="Parcels received today"
            data="1,284"
            description="12.4% vs yesterday"
            backHeader="Detailed Log Info"
            backDescription="Processing flow peaked between 9:00 AM and 11:00 AM. 94% processed via automated lines, remaining volume sorted manually."
          />
          <Cards
            header="Ready for dispatch"
            data="418"
            description="6.1%"
            backHeader="Queue Distribution"
            backDescription="310 items assigned to regional routes, 108 staged for long-haul/international transport. Next carrier sweeps at 4:30 PM."
          />
          <Cards
            header="Dispatched (MTD)"
            data="28,904"
            description="3.8%"
            backHeader="Monthly Breakdown"
            backDescription="Month-to-date volume is tracking 3.8% higher than projected targets, driven heavily by promotional events last week."
          />
          <Cards
            header="On-time dispatch rate"
            data="98.2%"
            description="0.6 pts"
            backHeader="SLA Compliance"
            backDescription="Target floor is set at 98.0%. Minor delays occurred entirely due to late arrivals from third-party regional linehauls."
          />
        </div>

        {/* AI Questions */}
        <AiQuestions />

        {/* Executive Charts - Now includes all sections with tabs */}
        <ExecutiveCharts />
      </div>
    </SessionGuard>
  );
}