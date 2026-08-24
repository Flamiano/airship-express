"use client";

import GlobalNavbar from "../../components/GlobalNavbar";
import GlobalFooter from "../../components/GlobalFooter";

import { useMemo, useState, useEffect } from "react";
import { getDashboardSnapshot } from "../../lib/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

// dailySpendData is computed from snapshot.fuelLogs when available

export default function FuelRefuelingLogPage() {
  const [dateSortDirection, setDateSortDirection] = useState<"asc" | "desc">("desc");
  const [showExportNotice, setShowExportNotice] = useState(false);
  const [showManualNotice, setShowManualNotice] = useState(false);
  const [fuelFilter, setFuelFilter] = useState<FuelType | "All Fuel Types">("All Fuel Types");
  const [dateRangeFilter, setDateRangeFilter] = useState<"Last 7 Days" | "Last 30 Days" | "This Month" | "Custom Range">("Last 30 Days");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [snapshot, setSnapshot] = useState<any | null>(null);

  const [hasData, setHasData] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const dash = await getDashboardSnapshot();
        const logs = dash.fuelLogs || [];
        if (mounted) {
          setHasData(Boolean(logs.length));
          setSnapshot(dash);
        }
      } catch (e) {
        console.warn('Failed to load fuel snapshot', e);
        if (mounted) setHasData(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const rowsView = useMemo(() => {
    if (!hasData || !snapshot) return [] as any[];
    const vehicles = snapshot.vehicles || [];
    return (snapshot.fuelLogs || []).map((log: any) => {
      const dateObj = new Date(log.loggedAt ?? log.logged_at ?? log.createdAt ?? log.created_at ?? Date.now());
      const vehicle = vehicles.find((v: any) => v.id === (log.vehicleId ?? log.vehicle_id));
      const vtype = String(vehicle?.vehicle_type ?? vehicle?.vehicleType ?? "").toLowerCase();
      const fuelType: any = /ev|electric/.test(vtype) ? "Electric" : /hydrogen/.test(vtype) ? "Hydrogen" : "Diesel";
      const unit = fuelType === "Electric" ? "kWh" : fuelType === "Hydrogen" ? "kg" : "L";
      return {
        date: dateObj.toLocaleDateString(),
        time: dateObj.toLocaleTimeString(),
        vehicle: vehicle?.plateNumber ?? vehicle?.plate_number ?? vehicle?.id ?? String(log.vehicleId ?? log.vehicle_id ?? "-").slice(0, 8),
        fuel: fuelType,
        volume: `${Math.round(Number(log.liters ?? log.amount ?? 0) || 0)} ${unit}`,
        cost: log.cost ? `$${Number(log.cost).toFixed(2)}` : "—",
        station: log.station ?? "—",
        status: "done",
      };
    });
  }, [hasData, snapshot]);

  const sortedRows = useMemo(() => {
    const direction = dateSortDirection === "asc" ? 1 : -1;
    return [...rowsView].sort((a, b) => {
      const dateA = new Date(`${a.date} ${a.time}`).getTime();
      const dateB = new Date(`${b.date} ${b.time}`).getTime();
      return (dateA - dateB) * direction;
    });
  }, [dateSortDirection, rowsView]);

  // Keep page structure visible; components will render placeholders if `hasData` is false.

  const dailySpendDataView = (() => {
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const map: Record<string, number> = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
    if (!hasData || !snapshot) return labels.map((d) => ({ day: d, spend: 0 }));
    const logs = snapshot.fuelLogs || [];
    for (const l of logs) {
      const date = new Date(l.loggedAt ?? l.logged_at ?? l.createdAt ?? l.created_at ?? Date.now());
      const day = date.toLocaleDateString(undefined, { weekday: 'short' });
      const cost = Number(l.cost ?? 0) || 0;
      map[day] = (map[day] || 0) + cost;
    }
    return labels.map((d) => ({ day: d, spend: Math.round(map[d] || 0) }));
  })();

  const totalTransactions = (() => {
    if (!hasData || !snapshot) return 0;
    return (snapshot.fuelLogs || []).length || 0;
  })();

  const avgDispatchCost = (() => {
    if (!hasData || !snapshot) return "—";
    const logs = snapshot.fuelLogs || [];
    const costs = logs.map((l: any) => Number(l.cost ?? 0)).filter((c: number) => c > 0);
    if (!costs.length) return "—";
    const avg = costs.reduce((s: number, c: number) => s + c, 0) / costs.length;
    return `$${avg.toFixed(2)}`;
  })();

  const totalSpendMTD = (() => {
    if (!hasData || !snapshot) return "—";
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const logs = snapshot.fuelLogs || [];
    const total = logs.reduce((s: number, l: any) => {
      const ts = new Date(l.loggedAt ?? l.logged_at ?? l.createdAt ?? l.created_at ?? 0).getTime();
      if (ts >= start) return s + (Number(l.cost ?? 0) || 0);
      return s;
    }, 0);
    return `$${Math.round(total).toLocaleString()}`;
  })();

  const peakDayLabel = (() => {
    if (!hasData || !dailySpendDataView) return "Peak Day: — ($0)";
    const max = dailySpendDataView.reduce((best, d) => (d.spend > best.spend ? d : best), dailySpendDataView[0]);
    return `Peak Day: ${max.day} ($${max.spend})`;
  })();

  const filteredRows = useMemo(() => {
    return sortedRows.filter((row) => {
      const matchesFuel = fuelFilter === "All Fuel Types" || row.fuel === fuelFilter;
      const matchesSearch = 
        row.vehicle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.station.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFuel && matchesSearch;
    });
  }, [sortedRows, fuelFilter, searchQuery]);

  const toggleDateSort = () => setDateSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));

  return (
    <div className="flex flex-col min-h-screen bg-[#fff7fc] text-[#141d23]">
      <GlobalNavbar />
      
      

      <main className="flex-grow w-full max-w-[1700px] mx-auto px-6 md:px-12 py-8 flex flex-col gap-8">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-[#ec2188]/15 shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#b80049]/10 text-[#b80049] uppercase tracking-wider">
                Courier Fuel Telemetry &amp; Finance
              </span>
              <span className="text-xs text-[#5b6b79]">• Live Delivery Audit</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-[#141d23] tracking-tight">Fuel Log &amp; Delivery Transactions</h1>
            <p className="text-sm md:text-base text-[#5b6b79] mt-1.5 max-w-2xl">
              Monitor real-time fuel dispensations, audit hub transactions, and manage delivery route fuel records across Airship Express operations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => {
                setShowExportNotice(true);
                window.setTimeout(() => setShowExportNotice(false), 2500);
              }}
              className="flex items-center gap-2 bg-white border border-[#ec2188]/20 px-4 py-2.5 rounded-xl text-sm font-medium text-[#141d23] hover:border-[#b80049] hover:bg-[#fff7fc] transition-all shadow-xs"
            >
              <Icon name="download" className="text-[#b80049] text-[18px]" />
              Export CSV
            </button>
            <button
              onClick={() => {
                setShowManualNotice(true);
                window.setTimeout(() => setShowManualNotice(false), 2500);
              }}
              className="flex items-center gap-2 bg-[#b80049] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#9a003c] transition-all shadow-md shadow-[#b80049]/20"
            >
              <Icon name="add" className="text-[18px]" />
              Manual Entry
            </button>
          </div>
        </header>

        {/* Notices */}
        {showExportNotice && (
          <div className="rounded-xl border border-[#b80049]/30 bg-[#b80049]/10 text-[#b80049] px-4 py-3 text-sm font-medium animate-in fade-in duration-200">
            ✓ CSV export started. Your download will appear shortly.
          </div>
        )}
        {showManualNotice && (
          <div className="rounded-xl border border-[#ec2188]/30 bg-[#fff7fc] text-[#b80049] px-4 py-3 text-sm font-medium border-l-4 border-l-[#b80049] animate-in fade-in duration-200">
            + Manual entry mode enabled. Ready to record new refueling transaction.
          </div>
        )}

        {/* Top KPI Cards & Bento Chart Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* KPI Stack (4 Columns) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            {/* KPI 1 */}
            <div className="bg-white rounded-2xl p-6 border border-[#ec2188]/15 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#5b6b79]">Total Monthly Transactions</span>
                <div className="bg-[#b80049]/10 p-2.5 rounded-xl">
                  <Icon name="receipt_long" className="text-[#b80049] text-[20px]" />
                </div>
              </div>
              <div>
                <div className="text-3xl font-black text-[#141d23]">{hasData ? totalTransactions.toLocaleString() : "—"}</div>
                <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full w-fit border border-emerald-200">
                  <Icon name="trending_up" className="text-[14px]" />
                  <span>+4.2% from last month</span>
                </div>
              </div>
            </div>

            {/* KPI 2 */}
            <div className="bg-white rounded-2xl p-6 border border-[#ec2188]/15 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#5b6b79]">Average Dispatch Fuel Cost</span>
                <div className="bg-[#fff7fc] border border-[#ec2188]/20 p-2.5 rounded-xl">
                  <Icon name="payments" className="text-[#b80049] text-[20px]" />
                </div>
              </div>
              <div>
                <div className="text-3xl font-black text-[#141d23]">{avgDispatchCost}</div>
                <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-[#5b6b79] bg-[#fff7fc] px-2.5 py-1 rounded-full w-fit border border-[#ec2188]/20">
                  <Icon name="horizontal_rule" className="text-[14px]" />
                  <span>Stable rolling average</span>
                </div>
              </div>
            </div>

            {/* KPI 3 */}
            <div className="bg-white rounded-2xl p-6 border border-[#ec2188]/15 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#5b6b79]">Total Route Fuel Spend (MTD)</span>
                <div className="bg-[#b80049]/10 p-2.5 rounded-xl">
                  <Icon name="account_balance_wallet" className="text-[#b80049] text-[20px]" />
                </div>
              </div>
              <div>
                <div className="text-3xl font-black text-[#141d23]">{totalSpendMTD}</div>
                <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full w-fit border border-rose-200">
                  <Icon name="trending_up" className="text-[14px]" />
                  <span>+1.8% over monthly budget</span>
                </div>
              </div>
            </div>

          </div>

          {/* Daily Spend Distribution Chart (8 Columns) */}
          <div className="lg:col-span-8 bg-white rounded-2xl border border-[#ec2188]/15 p-6 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-6 flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-[#fff7fc] text-[#b80049] border border-[#ec2188]/20">
                    <Icon name="bar_chart" className="text-xl" />
                  </span>
                  <div>
                    <h2 className="text-lg font-bold text-[#141d23]">Daily Delivery Fuel Expenditure</h2>
                    <p className="text-xs text-[#5b6b79]">Aggregate fuel outflow across all hubs this week</p>
                  </div>
                </div>
              </div>
              <div className="text-xs bg-[#fff7fc] text-[#5b6b79] px-3 py-1.5 rounded-xl border border-[#ec2188]/20 font-medium">
                {peakDayLabel}
              </div>
            </div>

            <div className="w-full h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailySpendDataView} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0e2ec" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: "#5b6b79", fontSize: 12 }} axisLine={{ stroke: "#f0e2ec" }} tickLine={false} />
                  <YAxis tick={{ fill: "#5b6b79", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#ffffff", borderRadius: 12, border: "1px solid rgba(233,30,99,0.2)", boxShadow: "0 10px 25px rgba(184,0,73,0.1)" }}
                    formatter={(val: any) => [`$${val}`, "Spend"]}
                  />
                  <Bar dataKey="spend" fill="#b80049" radius={[8, 8, 0, 0]}>
                    {dailySpendDataView.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.spend > 5000 ? "#b80049" : "#ec2188"} opacity={entry.spend > 5000 ? 1 : 0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* Table & Filtering Section */}
        <div className="bg-white rounded-2xl border border-[#ec2188]/15 shadow-sm overflow-hidden">
          
          {/* Filter Bar */}
          <div className="p-5 border-b border-[#ec2188]/15 flex flex-col lg:flex-row gap-4 justify-between items-center bg-[#fff7fc]/60">
            <div className="relative w-full lg:w-96">
              <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5b6b79] text-[20px]" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#ec2188]/20 rounded-xl text-sm text-[#141d23] focus:outline-none focus:ring-2 focus:ring-[#b80049]/30 placeholder-[#5b6b79]"
                placeholder="Search by Unit ID or Hub..."
                type="text"
              />
            </div>
            
            <div className="flex flex-wrap gap-3 w-full lg:w-auto items-center">
              <select
                value={fuelFilter}
                onChange={(e) => setFuelFilter(e.target.value as FuelType | "All Fuel Types")}
                className="bg-white border border-[#ec2188]/20 rounded-xl px-4 py-2.5 text-xs font-semibold text-[#141d23] focus:outline-none focus:ring-2 focus:ring-[#b80049]/30"
              >
                <option>All Fuel Types</option>
                <option>Electric</option>
                <option>Diesel</option>
                <option>Hydrogen</option>
              </select>

              <select
                value={dateRangeFilter}
                onChange={(e) => setDateRangeFilter(e.target.value as typeof dateRangeFilter)}
                className="bg-white border border-[#ec2188]/20 rounded-xl px-4 py-2.5 text-xs font-semibold text-[#141d23] focus:outline-none focus:ring-2 focus:ring-[#b80049]/30"
              >
                <option>Last 7 Days</option>
                <option>Last 30 Days</option>
                <option>This Month</option>
                <option>Custom Range</option>
              </select>

              <button className="bg-white border border-[#ec2188]/20 text-[#141d23] px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:border-[#b80049] hover:bg-[#fff7fc] transition-colors whitespace-nowrap shadow-xs">
                <Icon name="filter_list" className="text-[16px] text-[#b80049]" />
                More Filters
              </button>
            </div>
          </div>

          {/* Data Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#fff7fc] border-b border-[#ec2188]/15 text-[#5b6b79]">
                  <th className="p-4 text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                    <button
                      type="button"
                      onClick={toggleDateSort}
                      className="inline-flex items-center gap-1.5 font-bold text-[#141d23] hover:text-[#b80049] transition-colors"
                    >
                      Date/Time
                      <span className="material-symbols-outlined text-[18px]">
                        {dateSortDirection === "asc" ? "expand_less" : "expand_more"}
                      </span>
                    </button>
                  </th>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider">Unit ID</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider">Fuel Type</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-right">Volume</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-right">Cost</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider">Station/Hub</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-center">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm text-[#141d23] divide-y divide-[#f0e2ec]">
                {filteredRows.length > 0 ? (
                  filteredRows.map((r, i) => {
                    const style = fuelStyles[r.fuel as FuelType];
                    return (
                      <tr key={i} className="hover:bg-[#fff7fc]/50 transition-colors">
                        <td className="p-4 whitespace-nowrap">
                          <div className="font-semibold">{r.date}</div>
                          <div className="text-xs text-[#5b6b79]">{r.time}</div>
                        </td>
                        <td className="p-4 font-bold text-[#141d23]">{r.vehicle}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${style.classes}`}>
                            <Icon name={style.icon} className="text-[14px]" />
                            {r.fuel}
                          </span>
                        </td>
                        <td className="p-4 text-right font-medium">{r.volume}</td>
                        <td className="p-4 text-right font-extrabold text-[#b80049]">{r.cost}</td>
                        <td className="p-4 text-[#5b6b79] font-medium">{r.station}</td>
                        <td className="p-4 text-center">
                          <span className="inline-flex items-center justify-center">
                            <Icon
                              name={r.status === "done" ? "check_circle" : "pending"}
                              className={r.status === "done" ? "text-emerald-600 text-[20px]" : "text-amber-500 text-[20px]"}
                              fill
                            />
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-[#5b6b79]">
                      No refueling records match your current filter or search criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
            <div className="p-4 border-t border-[#ec2188]/15 flex items-center justify-between bg-white flex-wrap gap-3">
            <span className="text-xs text-[#5b6b79] font-medium">Showing {filteredRows.length} of {hasData ? totalTransactions.toLocaleString() : "—"} total transactions</span>
            <div className="flex gap-1.5 items-center">
              <button 
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-[#ec2188]/20 hover:bg-[#fff7fc] text-[#5b6b79] disabled:opacity-40 transition-colors"
                disabled={currentPage === 1}
              >
                <Icon name="chevron_left" className="text-[18px]" />
              </button>
              <button className="w-8 h-8 rounded-lg bg-[#b80049] text-white text-xs font-bold flex items-center justify-center shadow-xs">1</button>
              <button onClick={() => setCurrentPage(2)} className="w-8 h-8 rounded-lg hover:bg-[#fff7fc] text-[#141d23] text-xs font-semibold flex items-center justify-center transition-colors">2</button>
              <button onClick={() => setCurrentPage(3)} className="w-8 h-8 rounded-lg hover:bg-[#fff7fc] text-[#141d23] text-xs font-semibold flex items-center justify-center transition-colors">3</button>
              <button 
                onClick={() => setCurrentPage((p) => p + 1)}
                className="p-1.5 rounded-lg border border-[#ec2188]/20 hover:bg-[#fff7fc] text-[#141d23] transition-colors"
              >
                <Icon name="chevron_right" className="text-[18px]" />
              </button>
            </div>
          </div>

        </div>
      </main>

      <GlobalFooter />
    </div>
  );
}

type FuelType = "Electric" | "Diesel" | "Hydrogen";

const fuelStyles: Record<FuelType, { icon: string; classes: string }> = {
  Electric: { icon: "bolt", classes: "bg-[#b80049]/10 text-[#b80049] border border-[#b80049]/20" },
  Diesel: { icon: "local_gas_station", classes: "bg-[#141d23]/5 text-[#141d23] border border-[#141d23]/15" },
  Hydrogen: { icon: "water_drop", classes: "bg-[#ec2188]/10 text-[#ec2188] border border-[#ec2188]/20" },
};

// Rows are derived from `snapshot.fuelLogs` when available; seeded sample rows removed.

function Icon({
  name,
  className = "",
  fill = false,
}: {
  name: string;
  className?: string;
  fill?: boolean;
}) {
  return <span className={`material-symbols-outlined ${fill ? "icon-fill" : ""} ${className}`}>{name}</span>;
}