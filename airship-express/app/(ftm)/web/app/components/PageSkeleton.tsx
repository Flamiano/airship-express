"use client";

import { usePathname } from "next/navigation";

type BlockProps = { className?: string; style?: React.CSSProperties };

export function SkeletonBlock({ className = "", style }: BlockProps) {
  return <div aria-hidden="true" style={style} className={`animate-pulse rounded-lg bg-slate-200/80 ${className}`} />;
}

export function SkeletonPageHeader() {
  return <div className="flex flex-col justify-between gap-4 rounded-2xl border border-pink-100 bg-white/80 p-6 sm:flex-row sm:items-center"><div className="space-y-3"><SkeletonBlock className="h-7 w-56" /><SkeletonBlock className="h-4 w-80 max-w-full" /></div><SkeletonBlock className="h-10 w-32" /></div>;
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: count }, (_, index) => <div key={index} className="min-h-[112px] rounded-xl border border-pink-100 bg-white p-4"><SkeletonBlock className="h-3 w-20" /><SkeletonBlock className="mt-5 h-7 w-16" /><SkeletonBlock className="mt-3 h-2 w-full" /></div>)}</div>;
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return <div className="overflow-hidden rounded-2xl border border-pink-100 bg-white"><div className="flex gap-4 border-b border-slate-100 p-4"><SkeletonBlock className="h-4 flex-1" /><SkeletonBlock className="h-4 w-24" /><SkeletonBlock className="h-4 w-16" /></div>{Array.from({ length: rows }, (_, index) => <div key={index} className="flex items-center gap-4 border-b border-slate-100 p-4 last:border-0"><SkeletonBlock className="h-9 w-9 rounded-full" /><SkeletonBlock className="h-4 flex-1" /><SkeletonBlock className="h-4 w-24" /><SkeletonBlock className="h-7 w-20" /></div>)}</div>;
}

export function SkeletonMap({ className = "" }: { className?: string }) {
  return <div className={`relative overflow-hidden rounded-2xl border border-pink-100 bg-slate-100 ${className}`}><SkeletonBlock className="absolute left-[16%] top-[22%] h-3 w-3 rounded-full bg-pink-200" /><SkeletonBlock className="absolute right-[24%] top-[42%] h-3 w-3 rounded-full bg-pink-200" /><SkeletonBlock className="absolute bottom-[24%] left-[45%] h-3 w-3 rounded-full bg-pink-200" /></div>;
}

function DashboardSkeleton() { return <Shell><SkeletonPageHeader /><SkeletonStats count={8} /><div className="grid gap-6 lg:grid-cols-3"><SkeletonMap className="min-h-[430px] lg:col-span-2" /><div className="space-y-6"><Panel /><Panel /></div></div><div className="grid gap-6 lg:grid-cols-2"><Chart /><SkeletonTable rows={4} /></div></Shell>; }
function FleetSkeleton() { return <Shell><SkeletonPageHeader /><SkeletonStats /><div className="grid gap-6 lg:grid-cols-3"><SkeletonMap className="min-h-[360px] lg:col-span-2" /><Panel /></div><SkeletonTable rows={6} /></Shell>; }
function DispatchSkeleton() { return <Shell><SkeletonPageHeader /><SkeletonStats count={6} /><div className="grid gap-6 lg:grid-cols-3"><SkeletonMap className="min-h-[460px] lg:col-span-2" /><div className="space-y-4"><Panel /><Panel /></div></div></Shell>; }
function ListSkeleton() { return <Shell><SkeletonPageHeader /><div className="flex flex-wrap gap-3"><SkeletonBlock className="h-10 w-64" /><SkeletonBlock className="h-10 w-28" /><SkeletonBlock className="h-10 w-28" /></div><SkeletonStats /><SkeletonTable rows={7} /></Shell>; }
function RouteSkeleton() { return <Shell><SkeletonPageHeader /><div className="grid gap-6 lg:grid-cols-3"><SkeletonMap className="min-h-[510px] lg:col-span-2" /><div className="space-y-4"><Panel /><Panel /><Panel /></div></div></Shell>; }
function AnalyticsSkeleton() { return <Shell><SkeletonPageHeader /><SkeletonStats /><div className="grid gap-6 lg:grid-cols-2"><Chart /><Chart /></div><SkeletonTable rows={5} /></Shell>; }
function SettingsSkeleton() { return <Shell><SkeletonPageHeader /><div className="grid gap-6 lg:grid-cols-[240px_1fr]"><Panel /><div className="space-y-5 rounded-2xl border border-pink-100 bg-white p-6"><SkeletonBlock className="h-6 w-48" />{Array.from({ length: 5 }, (_, i) => <div key={i} className="space-y-2"><SkeletonBlock className="h-3 w-28" /><SkeletonBlock className="h-11 w-full" /></div>)}</div></div></Shell>; }
function AuthSkeleton() { return <div className="flex min-h-screen items-center justify-center bg-[#fcfbf9] p-6"><div className="w-full max-w-md space-y-5 rounded-3xl border border-pink-100 bg-white p-8 shadow-sm"><SkeletonBlock className="mx-auto h-12 w-12 rounded-2xl" /><SkeletonBlock className="mx-auto h-6 w-44" /><SkeletonBlock className="h-11 w-full" /><SkeletonBlock className="h-11 w-full" /><SkeletonBlock className="h-12 w-full" /></div></div>; }
function Shell({ children }: { children: React.ReactNode }) { return <main role="status" aria-label="Loading page" className="min-h-screen space-y-6 bg-gradient-to-br from-pink-50/60 via-white to-rose-50/40 px-4 py-6 sm:px-6 lg:px-10">{children}</main>; }
function Panel() { return <div className="space-y-4 rounded-2xl border border-pink-100 bg-white p-5"><SkeletonBlock className="h-5 w-32" /><SkeletonBlock className="h-4 w-full" /><SkeletonBlock className="h-4 w-4/5" /><SkeletonBlock className="h-10 w-full" /></div>; }
function Chart() { return <div className="h-[280px] rounded-2xl border border-pink-100 bg-white p-5"><SkeletonBlock className="h-5 w-40" /><div className="mt-8 flex h-[190px] items-end gap-3">{[45, 75, 55, 90, 65, 80].map((height, i) => <SkeletonBlock key={i} className="flex-1" style={{ height: `${height}%` }} />)}</div></div>; }

/** Selects a layout-shaped skeleton for every FTM route. */
export default function PageSkeleton() {
  const pathname = usePathname() || "";
  if (/auth/i.test(pathname)) return <AuthSkeleton />;
  if (/route-planning/.test(pathname)) return <RouteSkeleton />;
  if (/dashboard/.test(pathname)) return <DashboardSkeleton />;
  if (/fvm|fleet/.test(pathname)) return <FleetSkeleton />;
  if (/vrds/.test(pathname)) return <DispatchSkeleton />;
  if (/parcels|bookings|history|missions|alerts/.test(pathname)) return <ListSkeleton />;
  if (/cost|analytics|performance|leaderboard|safety|fuel/.test(pathname)) return <AnalyticsSkeleton />;
  if (/settings|account/.test(pathname)) return <SettingsSkeleton />;
  return <DashboardSkeleton />;
}
