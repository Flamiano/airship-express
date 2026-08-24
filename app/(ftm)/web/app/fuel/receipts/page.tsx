"use client";

import { useMemo, useState, useEffect } from "react";
import { getDashboardSnapshot } from "../../lib/api";
import GlobalNavbar from "../../components/GlobalNavbar";
import GlobalFooter from "../../components/GlobalFooter";

type Receipt = {
  id: string;
  vehicle: string;
  driver: string;
  category: string;
  amount: number;
  date: string;
  station: string;
  note?: string;
  image?: string;
};

const sampleReceipts: Receipt[] = [];
const currency = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2,
});

export default function FuelReceiptsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);

  const filteredReceipts = useMemo(() => {
    return sampleReceipts.filter((receipt) => {
      const matchesQuery =
        receipt.vehicle.toLowerCase().includes(search.toLowerCase()) ||
        receipt.driver.toLowerCase().includes(search.toLowerCase()) ||
        receipt.station.toLowerCase().includes(search.toLowerCase()) ||
        (receipt.note || "").toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category === "All" || receipt.category === category;
      return matchesQuery && matchesCategory;
    });
  }, [search, category]);

  const totalValue = filteredReceipts.reduce((sum, item) => sum + (item.amount || 0), 0);

  const [hasData, setHasData] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const dash = await getDashboardSnapshot();
        const logs = dash.fuelLogs || [];
        if (mounted) setHasData(Boolean(logs.length));
      } catch (e) {
        console.warn('Failed to load fuel snapshot', e);
        if (mounted) setHasData(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Keep page layout visible; show placeholders (0/—) inside components when no data.

  const visibleReceipts = hasData ? filteredReceipts : [];
  const displayedTotal = hasData ? totalValue : 0;

  return (
    <div className="min-h-screen bg-[#fff7fc] text-slate-900">
      <GlobalNavbar />

      <main className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 px-4 py-8 sm:px-6 md:px-10">
        <header className="rounded-3xl border border-pink-100 bg-white p-6 shadow-sm shadow-pink-900/5 sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-pink-700">Fuel management</p>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Courier expense receipts</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Quick review of submitted courier receipts for delivery fuel, toll, parking, and maintenance costs.
              </p>
            </div>

            <div className="rounded-2xl bg-pink-50 px-4 py-3 text-sm font-semibold text-pink-700 ring-1 ring-pink-200">
              {hasData ? `${visibleReceipts.length} submitted receipts` : "—"}
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-pink-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Visible total</p>
            <p className="mt-3 text-3xl font-black text-slate-900">{hasData ? currency.format(displayedTotal) : "—"}</p>
          </div>
          <div className="rounded-2xl border border-pink-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Top category</p>
            <p className="mt-3 text-3xl font-black text-slate-900">Fuel</p>
          </div>
          <div className="rounded-2xl border border-pink-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Last upload</p>
            <p className="mt-3 text-3xl font-black text-slate-900">Aug 9</p>
          </div>
        </section>

        <section className="rounded-3xl border border-pink-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400">search</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search unit, driver, station..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-3 text-sm outline-none ring-0 transition focus:border-pink-300 focus:bg-white"
              />
            </div>

            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none transition focus:border-pink-300 focus:bg-white"
            >
              <option value="All">All categories</option>
              <option value="Fuel">Fuel</option>
              <option value="Toll">Toll</option>
              <option value="Parking">Parking</option>
              <option value="Maintenance">Maintenance</option>
            </select>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visibleReceipts.map((receipt) => (
            <article key={receipt.id} className="overflow-hidden rounded-3xl border border-pink-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <button
                type="button"
                onClick={() => setSelectedReceipt(receipt)}
                className="block w-full text-left"
                aria-label={`View receipt for ${receipt.vehicle}`}
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                  <img src={receipt.image} alt={`${receipt.vehicle} receipt`} className="h-full w-full object-cover transition duration-300 hover:scale-[1.02]" />
                  <div className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-pink-700">
                    {receipt.category}
                  </div>
                </div>
              </button>

              <div className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">{receipt.id}</p>
                    <h2 className="mt-1 text-lg font-extrabold text-slate-900">{receipt.vehicle}</h2>
                  </div>
                  <span className="text-base font-black text-slate-900">{currency.format(receipt.amount)}</span>
                </div>

                <div className="space-y-1 text-sm text-slate-600">
                  <p><span className="font-semibold text-slate-700">Driver:</span> {receipt.driver}</p>
                  <p><span className="font-semibold text-slate-700">Station:</span> {receipt.station}</p>
                  <p><span className="font-semibold text-slate-700">Date:</span> {new Date(receipt.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                </div>

                <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">{receipt.note}</p>

                <button
                  type="button"
                  onClick={() => setSelectedReceipt(receipt)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#b80049] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#96003b]"
                >
                  View image
                  <span className="material-symbols-outlined text-base">visibility</span>
                </button>
              </div>
            </article>
          ))}
        </section>
      </main>

      {selectedReceipt && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <button
              type="button"
              onClick={() => setSelectedReceipt(null)}
              className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-sm transition hover:bg-white"
              aria-label="Close receipt preview"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            <div className="grid gap-0 lg:grid-cols-[1.5fr_0.9fr]">
              <div className="bg-slate-100">
                <img src={selectedReceipt.image} alt={`${selectedReceipt.vehicle} receipt`} className="h-full max-h-[78vh] w-full object-contain" />
              </div>

              <div className="space-y-4 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-pink-700">Receipt</p>
                    <h3 className="mt-1 text-2xl font-black text-slate-900">{selectedReceipt.vehicle}</h3>
                  </div>
                  <span className="rounded-full bg-pink-50 px-2.5 py-1 text-xs font-bold text-pink-700 ring-1 ring-pink-100">
                    {selectedReceipt.category}
                  </span>
                </div>

                <div className="grid gap-3 text-sm text-slate-600">
                  <p><span className="font-semibold text-slate-700">ID:</span> {selectedReceipt.id}</p>
                  <p><span className="font-semibold text-slate-700">Driver:</span> {selectedReceipt.driver}</p>
                  <p><span className="font-semibold text-slate-700">Station:</span> {selectedReceipt.station}</p>
                  <p><span className="font-semibold text-slate-700">Date:</span> {new Date(selectedReceipt.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                  <p><span className="font-semibold text-slate-700">Amount:</span> {currency.format(selectedReceipt.amount)}</p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
                  {selectedReceipt.note}
                </div>

                <a
                  href={selectedReceipt.image}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#b80049] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#96003b]"
                >
                  Open original image
                  <span className="material-symbols-outlined text-base">open_in_new</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      <GlobalFooter />
    </div>
  );
}
