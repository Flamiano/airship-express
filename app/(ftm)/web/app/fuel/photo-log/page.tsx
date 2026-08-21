"use client";

import { useMemo, useState, useEffect } from "react";
import { getDashboardSnapshot } from "../../lib/api";
import GlobalNavbar from "../../components/GlobalNavbar";
import GlobalFooter from "../../components/GlobalFooter";

type PhotoEntry = {
  id: string;
  vehicle: string;
  driver: string;
  date: string;
  location: string;
  note: string;
  image?: string;
};

const photoEntries: PhotoEntry[] = [];
export default function FuelPhotoLogPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PhotoEntry | null>(null);

  const filteredEntries = useMemo(() => {
    const q = search.toLowerCase();
    return photoEntries.filter((entry) => {
      return (
        entry.vehicle.toLowerCase().includes(q) ||
        entry.driver.toLowerCase().includes(q) ||
        entry.location.toLowerCase().includes(q) ||
        entry.note.toLowerCase().includes(q)
      );
    });
  }, [search]);

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

  // Keep the gallery and layout visible; individual cards will show placeholders if needed.

  const visibleEntries = hasData ? filteredEntries : [];

  return (
    <div className="min-h-screen bg-[#fff7fc] text-slate-900">
      <GlobalNavbar />

      <main className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 px-4 py-8 sm:px-6 md:px-10">
        <header className="rounded-3xl border border-pink-100 bg-white p-6 shadow-sm shadow-pink-900/5 sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-pink-700">Gallery</p>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Courier fuel photo log</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Recent delivery fuel and operational photos captured from the field for dispatch validation and review.
              </p>
            </div>

            <div className="rounded-2xl bg-pink-50 px-4 py-3 text-sm font-semibold text-pink-700 ring-1 ring-pink-200">
              {hasData ? `${visibleEntries.length} photo entries` : "—"}
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-pink-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400">search</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search unit, driver, location..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-3 text-sm outline-none ring-0 transition focus:border-pink-300 focus:bg-white"
            />
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visibleEntries.map((entry) => (
            <article key={entry.id} className="overflow-hidden rounded-3xl border border-pink-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <button type="button" onClick={() => setSelected(entry)} className="block w-full text-left" aria-label={`View photo log for ${entry.vehicle}`}>
                <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                  <img src={entry.image} alt={`${entry.vehicle} fuel photo`} className="h-full w-full object-cover transition duration-300 hover:scale-[1.02]" />
                  <div className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-pink-700">
                    {entry.id}
                  </div>
                </div>
              </button>

              <div className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Delivery unit</p>
                    <h2 className="mt-1 text-lg font-extrabold text-slate-900">{entry.vehicle}</h2>
                  </div>
                  <span className="rounded-full bg-pink-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-pink-700 ring-1 ring-pink-100">
                    {new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>

                <div className="space-y-1 text-sm text-slate-600">
                  <p><span className="font-semibold text-slate-700">Driver:</span> {entry.driver}</p>
                  <p><span className="font-semibold text-slate-700">Location:</span> {entry.location}</p>
                </div>

                <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">{entry.note}</p>

                <button
                  type="button"
                  onClick={() => setSelected(entry)}
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

      {selected && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-sm transition hover:bg-white"
              aria-label="Close photo preview"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            <div className="grid gap-0 lg:grid-cols-[1.5fr_0.9fr]">
              <div className="bg-slate-100">
                <img src={selected.image} alt={`${selected.vehicle} fuel photo`} className="h-full max-h-[78vh] w-full object-contain" />
              </div>

              <div className="space-y-4 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-pink-700">Fuel log</p>
                    <h3 className="mt-1 text-2xl font-black text-slate-900">{selected.vehicle}</h3>
                  </div>
                  <span className="rounded-full bg-pink-50 px-2.5 py-1 text-xs font-bold text-pink-700 ring-1 ring-pink-100">
                    {selected.id}
                  </span>
                </div>

                <div className="grid gap-3 text-sm text-slate-600">
                  <p><span className="font-semibold text-slate-700">Driver:</span> {selected.driver}</p>
                  <p><span className="font-semibold text-slate-700">Location:</span> {selected.location}</p>
                  <p><span className="font-semibold text-slate-700">Date:</span> {new Date(selected.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
                  {selected.note}
                </div>

                <a
                  href={selected.image}
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
