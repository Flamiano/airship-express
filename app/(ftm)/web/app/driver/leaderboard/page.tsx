"use client";

import { useState, useEffect } from "react";
import { getDashboardSnapshot, getAlertsSnapshot } from "../../lib/api";
import html2canvas from "html2canvas";
import GlobalNavbar from "../../components/GlobalNavbar";
import GlobalFooter from "../../components/GlobalFooter";

const SARAH =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAwkJ0nddX74_5nG2LBVZGmtLg4mYflqHDi649RmNJCAVwhTSkYK3KaQOsBAoA9Zm3qDe1EmGty5mN3EuL4zt4hOQzgfpl6Z_fw-AQDlVmL8vM0RgnFgH9QyMfxoe2BKsogunMH0tLV39lGIcQPNAD_-hfB1d9KJQXShyqO9549lxxdCxXATw6kjy55nsYtcmT2aV2QqaVM66df8J9b-zJtb4d3s0rA2d_z8U5pe56XDrBBFB92RYOqSg";
const MARCUS =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBxJk3nqXLZE8pDDJE6TJj_Ko4opKTSQFqUKeQIKuzyeNf8MYyTszg641B3YlMK-liwih47vJI1GCalBSzJpOvKmlBDrnkcF5MM8hcLeYjtYhcjZH1RqDavhC35ocUoBggkcGhd8VgtAH9x3k13n7vgt-WgD5iOcz6dyTJfY0IC_APC2uOzwBckZ-MQiG8O4BSjUAt0ff-Q0VxyF4ejcTwHVDkiSFL6aPhiYPqn3ZmUvVkw6_bjHMxXPw";
const DAVID =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDQ6xzqPyt_2TmOLBL8ERJIgiJxNAqUTY0cZvnasRb1c3wYl9aQOsBtDZU03a5x9E0hIGiXy97td_xVGOCH6IYhCQ2oClKfKFzcAJv7bOpqj5vwsAZYl4k0jfXxryCzRQ1pFB502FimRbIbzbRpsxZNhnSmJl2_iWhhdGtM4Udr3LNtsIHiKjWH__F5_wTibZWFBp9XFt9LWGUxDuFTSYffmkEQMj_PuABNRx4wvs_3FIV-oMF2nnU0Ow";

export default function DriverLeaderboardPage() {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showExportNotice, setShowExportNotice] = useState(false);
  const [selectedRange, setSelectedRange] = useState<"Last 7 Days" | "Last 30 Days" | "This Month">("Last 30 Days");
  const [selectedRegion, setSelectedRegion] = useState("All Regions");
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const toggleFilterPanel = () => {
    setIsFilterOpen((prev) => !prev);
    setNoticeMessage(null);
  };

  const handleRowAction = (message: string) => {
    setNoticeMessage(message);
    setShowExportNotice(false);
    window.setTimeout(() => setNoticeMessage(null), 2500);
  };

  const [runners, setRunners] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({
    topPerformerName: "—",
    topPerformerScore: null,
    avgDeliveryScore: null,
    totalDeliveries: 0,
    activeDrivers: 0,
    divisionsCount: 0,
    activeRate: null,
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const snap = await getDashboardSnapshot();
        const drv = (snap.drivers || []).slice();
        // sort by score or safety metric if present
        drv.sort((a: any, b: any) => (Number(b.score ?? b.safety_score ?? b.performance ?? 0) - Number(a.score ?? a.safety_score ?? a.performance ?? 0)));
        const mapped = drv.map((d: any, i: number) => {
          const name = d.name || d.full_name || d.driverName || "Unknown";
          const score = Math.round(Number(d.score ?? d.safety_score ?? d.performance ?? 0));
          const missions = Number(d.missions ?? d.deliveries ?? 0);
          const initials = name.split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();
          return {
            id: d.id || d.driver_id || `drv-${i}`,
            rank: i + 1,
            name,
            division: d.division || d.region || "-",
            missions,
            score,
            avatar: d.avatar_url || d.photo || null,
            initials,
          };
        });
        // compute simple summary metrics
        const totalDeliveries = drv.reduce((s: number, x: any) => s + Number(x.missions ?? x.deliveries ?? 0), 0);
        const avgScore = drv.length ? (drv.reduce((s: number, x: any) => s + Number(x.score ?? x.safety_score ?? x.performance ?? 0), 0) / drv.length) : null;
        const divisionsCount = new Set(drv.map((d: any) => d.division || d.region || "")).size;
        const activeDrivers = drv.length;
        const topName = mapped[0]?.name ?? (drv[0]?.name ?? "—");
        const topScore = mapped[0]?.score ?? (drv[0]?.score ?? drv[0]?.safety_score ?? null);

        if (mounted) {
          setRunners(mapped.slice(0, 50));
          setSummary({
            topPerformerName: topName,
            topPerformerScore: topScore,
            avgDeliveryScore: avgScore != null ? Math.round(avgScore * 10) / 10 : null,
            totalDeliveries,
            activeDrivers,
            divisionsCount,
            activeRate: drv.length ? `${((activeDrivers / drv.length) * 100).toFixed(1)}%` : null,
          });
        }
      } catch (e) {
        console.warn("Failed to load drivers snapshot", e);
      }
    })();
    return () => { mounted = false; };
  }, [selectedRange, selectedRegion]);

  const handleExport = () => {
    const rows = [
      ["Rank", "Driver", "Division", "Missions", "Performance Score", "Range"],
      ...runners.map((d) => [d.rank.toString(), d.name, d.division || "-", d.missions.toString(), d.score.toString(), selectedRange]),
    ];
    downloadCsv(`driver-leaderboard-${selectedRange.replace(/\s+/g, "-").toLowerCase()}.csv`, rows);
    setShowExportNotice(true);
    setNoticeMessage(null);
    window.setTimeout(() => setShowExportNotice(false), 2500);
  };

  const handleExportXls = () => {
    const rows = [
      ["Rank", "Driver", "Division", "Missions", "Performance Score", "Range"],
      ...runners.map((d) => [d.rank.toString(), d.name, d.division || "-", d.missions.toString(), d.score.toString(), selectedRange]),
    ];
    downloadCsv(`driver-leaderboard-${selectedRange.replace(/\s+/g, "-").toLowerCase()}.xls`, rows);
    setShowExportNotice(true);
    setNoticeMessage(null);
    window.setTimeout(() => setShowExportNotice(false), 2500);
  };

  const handleExportPng = async () => {
    try {
      const exportTarget = document.getElementById("leaderboard-podium-export-root");
      if (!exportTarget) return setNoticeMessage("Leaderboard export target not found");
      
      const imgs = Array.from(exportTarget.querySelectorAll("img")) as HTMLImageElement[];
      await Promise.all(
        imgs.map((img) => {
          return new Promise((resolve) => {
            if (!img) return resolve(true);
            if (img.complete && img.naturalWidth !== 0) return resolve(true);
            const onLoad = () => { resolve(true); cleanup(); };
            const onErr = () => { resolve(true); cleanup(); };
            function cleanup() { img.removeEventListener("load", onLoad); img.removeEventListener("error", onErr); }
            img.addEventListener("load", onLoad);
            img.addEventListener("error", onErr);
          });
        })
      );

      const clone = exportTarget.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("button, select").forEach((n) => n.remove());
      const container = document.createElement("div");
      container.style.position = "fixed";
      container.style.left = "-9999px";
      container.style.top = "0";
      container.style.zIndex = "99999";
      container.appendChild(clone);
      document.body.appendChild(container);

      const scale = Math.max(2, Math.floor(window.devicePixelRatio || 2));
      clone.style.width = exportTarget.scrollWidth + "px";
      clone.style.maxWidth = "none";
      clone.style.maxHeight = "none";
      clone.style.overflow = "visible";
      clone.style.position = "relative";
      clone.style.paddingTop = "48px";
      clone.style.paddingBottom = "48px";

      const canvas = await html2canvas(clone, {
        backgroundColor: "#ffffff",
        scale,
        useCORS: true,
        imageTimeout: 30000,
        width: clone.scrollWidth,
        height: clone.scrollHeight,
        windowWidth: clone.scrollWidth,
        windowHeight: clone.scrollHeight,
      });
      container.remove();
      canvas.toBlob((blob: Blob | null) => {
        if (!blob) return setNoticeMessage("Failed to create image");
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `driver-leaderboard-${selectedRange.replace(/\s+/g, "-").toLowerCase()}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setShowExportNotice(true);
        setNoticeMessage(null);
        window.setTimeout(() => setShowExportNotice(false), 2500);
      }, "image/png");
    } catch (e) {
      setNoticeMessage("Failed to export PNG");
    }
  };

      {/* Main Full-Width Container */}
      return (
    <div className="bg-transparent text-inherit min-h-screen flex flex-col font-sans">
      <GlobalNavbar />

      <main className="flex-1 w-full max-w-[1800px] mx-auto px-4 sm:px-6 md:px-10 py-8 transition-all">
        <div id="leaderboard-root" className="flex flex-col gap-8">
          
          {/* Header Bar */}
          <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-6 sm:p-8 rounded-2xl border border-pink-100 shadow-sm shadow-pink-900/5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-pink-100 text-[#b80049] border border-pink-200/60">
                  Courier Rankings & Dispatch Recognition
                </span>
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Courier Driver Leaderboard
              </h1>
              <p className="text-slate-500 text-sm sm:text-base mt-1 max-w-2xl">
                Competitive ranking based on delivery safety, route completion speed, and telematics scoring for Airship Express operations. Refreshed daily.
              </p>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Range Selector */}
              <div className="flex items-center gap-2 bg-pink-50/60 border border-pink-200/80 rounded-xl px-3.5 py-2 hover:bg-pink-100/50 transition-all">
                <span className="material-symbols-outlined text-[#b80049] text-[20px]">calendar_today</span>
                <select
                  value={selectedRange}
                  onChange={(e) => setSelectedRange(e.target.value as any)}
                  className="bg-transparent border-none text-slate-800 text-sm font-semibold outline-none cursor-pointer pr-2"
                >
                  <option>Last 7 Days</option>
                  <option>Last 30 Days</option>
                  <option>This Month</option>
                </select>
              </div>

              {/* Filter Button */}
              <button
                type="button"
                onClick={toggleFilterPanel}
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all border ${
                  isFilterOpen
                    ? "bg-[#b80049] text-white border-[#b80049] shadow-sm shadow-pink-900/20"
                    : "bg-white text-slate-700 border-pink-200 hover:border-pink-300 hover:bg-pink-50/50"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">filter_list</span>
                <span>Filter</span>
              </button>

              {/* Export Button Group */}
              <div className="flex items-center bg-pink-50/50 p-1 rounded-xl border border-pink-200/80 gap-1">
                <button
                  type="button"
                  onClick={handleExport}
                  title="Export CSV"
                  className="px-3 py-1.5 bg-white border border-pink-100 rounded-lg text-slate-700 hover:text-[#b80049] text-xs font-bold flex items-center gap-1.5 hover:border-pink-300 shadow-2xs transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-[16px] text-[#b80049]">download</span>
                  CSV
                </button>
                <button
                  type="button"
                  onClick={handleExportXls}
                  title="Export Excel"
                  className="px-3 py-1.5 bg-white border border-pink-100 rounded-lg text-slate-700 hover:text-[#b80049] text-xs font-bold flex items-center gap-1.5 hover:border-pink-300 shadow-2xs transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-[16px] text-[#b80049]">table_chart</span>
                  Excel
                </button>
                <button
                  type="button"
                  onClick={handleExportPng}
                  title="Export PNG"
                  className="px-3 py-1.5 bg-[#b80049] text-white rounded-lg hover:bg-[#96003b] text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-[16px]">image</span>
                  PNG
                </button>
              </div>
            </div>
          </header>

          {/* Toast / Notification Banner */}
          {(showExportNotice || noticeMessage) && (
            <div className="flex items-center gap-3 rounded-xl border border-pink-200 bg-pink-50 text-[#b80049] px-5 py-3.5 text-sm font-semibold shadow-sm animate-fade-in">
              <span className="material-symbols-outlined text-xl">info</span>
              <span>
                {noticeMessage ?? `Export queued for ${selectedRange}. Your driver leaderboard report is being downloaded.`}
              </span>
            </div>
          )}

          {/* Filter Drawer Card */}
          {isFilterOpen && (
            <div className="rounded-2xl border border-pink-200 bg-white p-6 shadow-sm shadow-pink-900/5 animate-fade-in">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-pink-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Filter Leaderboard</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Refine rankings by geographical division and driver performance tiers.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleFilterPanel}
                  className="text-xs font-bold text-[#b80049] hover:underline flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                  Close Filters
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-2">Region:</span>
                {["All Regions", "Central Div.", "West Coast", "East Coast"].map((region) => (
                  <button
                    key={region}
                    type="button"
                    onClick={() => setSelectedRegion(region)}
                    className={`rounded-xl px-4 py-2 text-xs font-semibold border transition-all ${
                      selectedRegion === region
                        ? "bg-[#b80049] text-white border-[#b80049] shadow-xs"
                        : "bg-pink-50/50 text-slate-700 border-pink-200/80 hover:bg-pink-100/50"
                    }`}
                  >
                    {region}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Overview Key Metrics Banner */}
          {runners.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-pink-100 shadow-sm shadow-pink-900/5 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-medium block">Top Performer</span>
                <span className="text-base font-extrabold text-slate-900">{summary.topPerformerName}</span>
                <span className="text-xs text-[#b80049] font-bold block mt-0.5">{summary.topPerformerScore != null ? `${summary.topPerformerScore} Safety Score` : "—"}</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-pink-50 border border-pink-100 flex items-center justify-center text-[#b80049]">
                <span className="material-symbols-outlined text-2xl">emoji_events</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-pink-100 shadow-sm shadow-pink-900/5 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-medium block">Avg Delivery Score</span>
                <span className="text-base font-extrabold text-slate-900">{summary.avgDeliveryScore != null ? `${summary.avgDeliveryScore} PTS` : "—"}</span>
                <span className="text-xs text-emerald-600 font-bold block mt-0.5">+1.8% vs last month</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <span className="material-symbols-outlined text-2xl">verified</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-pink-100 shadow-sm shadow-pink-900/5 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-medium block">Total Deliveries</span>
                <span className="text-base font-extrabold text-slate-900">{summary.totalDeliveries.toLocaleString()} Completed</span>
                <span className="text-xs text-slate-500 block mt-0.5">Across {summary.divisionsCount} Divisions</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-pink-50 border border-pink-100 flex items-center justify-center text-[#b80049]">
                <span className="material-symbols-outlined text-2xl">local_shipping</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-pink-100 shadow-sm shadow-pink-900/5 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-medium block">Active Drivers</span>
                <span className="text-base font-extrabold text-slate-900">{summary.activeDrivers} Drivers</span>
                <span className="text-xs text-emerald-600 font-bold block mt-0.5">{summary.activeRate ?? "—"} Active Rate</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-pink-50 border border-pink-100 flex items-center justify-center text-[#b80049]">
                <span className="material-symbols-outlined text-2xl">groups</span>
              </div>
            </div>
            </div>
          )}

          {/* Podium Component Section */}
          {runners.length > 0 && (
            <div id="leaderboard-podium-export-root" className="bg-white rounded-2xl p-6 sm:p-10 border border-pink-100 shadow-sm shadow-pink-900/5 overflow-hidden">
            <div className="text-center mb-8">
              <span className="text-xs font-bold text-[#b80049] bg-pink-50 border border-pink-200/80 px-3 py-1 rounded-full uppercase tracking-wider">
                Top Performers Showcase
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
                Courier Hall of Fame
              </h2>
            </div>

            {/* Podium Grid - render top 3 from runners state */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end max-w-5xl mx-auto pt-6 pb-2">
              {(() => {
                const top = runners.slice(0, 3);
                const first = top[0];
                const second = top[1];
                const third = top[2];
                return (
                  <>
                    {/* 2nd Place */}
                    <div className="bg-slate-50/70 rounded-2xl border border-slate-200/80 p-6 flex flex-col items-center relative shadow-sm hover:shadow-md md:h-[300px] order-2 md:order-1 transition-all hover:-translate-y-1">
                      <div className="absolute -top-4 bg-slate-800 text-white text-xs font-bold px-3.5 py-1 rounded-full shadow-sm flex items-center gap-1 border border-slate-700">
                        <span className="material-symbols-outlined text-[16px] text-slate-300">workspace_premium</span>
                        2nd Place
                      </div>
                      <img
                        alt={second?.name ?? 'Runner'}
                        className="w-20 h-20 rounded-full object-cover mb-3 border-4 border-white shadow-md ring-2 ring-slate-300/50"
                        src={second?.avatar || SARAH}
                      />
                      <h3 className="text-base font-extrabold text-slate-900 mb-0.5">{second?.name ?? '—'}</h3>
                      <p className="text-xs font-semibold text-slate-500 mb-4">{second?.division ?? '-'}</p>
                      <div className="w-full bg-white rounded-xl p-3 border border-slate-200/70 flex justify-between items-center mt-auto shadow-2xs">
                        <span className="text-xs text-slate-500 font-medium">Deliveries: <strong className="text-slate-900">{second?.missions ?? '—'}</strong></span>
                        <div className="text-right">
                          <span className="text-xs text-slate-400 block leading-tight">Score</span>
                          <span className="text-base font-black text-[#b80049]">{second?.score ?? '—'}</span>
                        </div>
                      </div>
                    </div>

                    {/* 1st Place - Champion */}
                    <div className="bg-gradient-to-b from-pink-50/80 via-white to-pink-50/40 rounded-2xl border-2 border-[#b80049] p-6 flex flex-col items-center relative shadow-xl shadow-pink-900/10 md:h-[350px] order-1 md:order-2 z-10 transition-all hover:-translate-y-2">
                      <div className="absolute -top-5 bg-[#b80049] text-white text-xs font-extrabold px-4 py-1.5 rounded-full shadow-lg shadow-pink-900/30 flex items-center gap-1.5 uppercase tracking-wider">
                        <span className="material-symbols-outlined text-[18px] text-amber-300">trophy</span>
                        1st Place Champion
                      </div>
                      <div className="relative mb-3 mt-1">
                        <img
                          alt={first?.name ?? 'Champion'}
                          className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg ring-4 ring-pink-200"
                          src={first?.avatar || MARCUS}
                        />
                        <div className="absolute -bottom-1 -right-1 bg-amber-400 text-slate-900 p-1.5 rounded-full shadow-md flex items-center justify-center">
                          <span className="material-symbols-outlined text-sm font-black">crown</span>
                        </div>
                      </div>
                      <h3 className="text-lg font-black text-slate-900 mb-0.5">{first?.name ?? '—'}</h3>
                      <p className="text-xs font-bold text-[#b80049] mb-4">{first?.division ?? '-'}</p>
                      <div className="w-full grid grid-cols-2 gap-2 mt-auto">
                        <div className="bg-white rounded-xl p-3 flex flex-col items-center border border-pink-100 shadow-2xs">
                          <span className="text-[11px] font-semibold text-slate-400 uppercase">Deliveries</span>
                          <span className="text-sm font-black text-slate-900">{first?.missions ?? '—'}</span>
                        </div>
                        <div className="bg-[#b80049] rounded-xl p-3 flex flex-col items-center text-white shadow-md shadow-pink-900/20">
                          <span className="text-[11px] font-medium text-pink-200 uppercase">Score</span>
                          <span className="text-base font-black">{first?.score ?? '—'}</span>
                        </div>
                      </div>
                    </div>

                    {/* 3rd Place */}
                    <div className="bg-slate-50/70 rounded-2xl border border-slate-200/80 p-6 flex flex-col items-center relative shadow-sm hover:shadow-md md:h-[280px] order-3 transition-all hover:-translate-y-1">
                      <div className="absolute -top-4 bg-amber-800/90 text-white text-xs font-bold px-3.5 py-1 rounded-full shadow-sm flex items-center gap-1 border border-amber-700">
                        <span className="material-symbols-outlined text-[16px] text-amber-300">military_tech</span>
                        3rd Place
                      </div>
                      <img
                        alt={third?.name ?? 'Runner'}
                        className="w-18 h-18 rounded-full object-cover mb-3 border-4 border-white shadow-md ring-2 ring-amber-200/50"
                        src={third?.avatar || DAVID}
                      />
                      <h3 className="text-base font-extrabold text-slate-900 mb-0.5">{third?.name ?? '—'}</h3>
                      <p className="text-xs font-semibold text-slate-500 mb-4">{third?.division ?? '-'}</p>
                      <div className="w-full bg-white rounded-xl p-3 border border-slate-200/70 flex justify-between items-center mt-auto shadow-2xs">
                        <span className="text-xs text-slate-500 font-medium">Deliveries: <strong className="text-slate-900">{third?.missions ?? '—'}</strong></span>
                        <div className="text-right">
                          <span className="text-xs text-slate-400 block leading-tight">Score</span>
                          <span className="text-base font-black text-[#b80049]">{third?.score ?? '—'}</span>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </section>
            </div>
          )}

          {/* Full Standings Table - Spanning Full Width */}
          {runners.length > 0 ? (
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-pink-100 shadow-sm shadow-pink-900/5">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Full Driver Standings</h2>
                <p className="text-xs text-slate-500">Comprehensive driver performance and safety index rankings</p>
              </div>
              <span className="text-xs font-bold text-slate-500 bg-pink-50 px-3 py-1.5 rounded-lg border border-pink-100">
                Showing Top 10 Drivers
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-pink-100 text-slate-400 text-xs uppercase font-bold tracking-wider">
                    <th className="py-3.5 px-4">Rank</th>
                    <th className="py-3.5 px-4">Driver</th>
                    <th className="py-3.5 px-4">Division</th>
                    <th className="py-3.5 px-4 text-center">Deliveries</th>
                    <th className="py-3.5 px-4">Safety Meter</th>
                    <th className="py-3.5 px-4 text-right">Score</th>
                    <th className="py-3.5 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pink-50 text-sm">
                  {/* Top 3 Rows Highlighted */}
                  {runners.slice(0, 10).map((driver) => (
                    <tr key={driver.id || driver.rank} className="hover:bg-pink-50/30 transition-colors font-medium">
                      <td className="py-4 px-4 font-black text-[#b80049]">#{driver.rank}</td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-pink-100 text-[#b80049] font-bold text-xs flex items-center justify-center">
                            {driver.initials}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{driver.name}</span>
                            <span className="text-xs text-emerald-600 font-semibold">{driver.rank <=3 ? 'Top Driver' : 'Driver'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-slate-600">{driver.division ?? '-'}</td>
                      <td className="py-4 px-4 text-center font-semibold text-slate-900">{driver.missions}</td>
                      <td className="py-4 px-4 w-48">
                        <div className="w-full bg-pink-50 h-2 rounded-full overflow-hidden border border-pink-100">
                          <div
                            className="bg-[#b80049] h-full rounded-full"
                            style={{ width: `${driver.score}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right font-bold text-slate-900">{driver.score}</td>
                      <td className="py-4 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleRowAction(`Viewing telemetry details for ${driver.name}`)}
                          className="p-1.5 hover:bg-pink-100 rounded-lg text-[#b80049] transition-colors"
                          title="View Telematics"
                        >
                          <span className="material-symbols-outlined text-lg">analytics</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-pink-100 shadow-sm shadow-pink-900/5 text-center text-sm text-slate-500">
              No leaderboard data available.
            </div>
          )}

        </div>
      </main>

      <GlobalFooter />
    </div>
  );
}

// Note: leaderboard data is computed at runtime from Supabase via getDashboardSnapshot

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

