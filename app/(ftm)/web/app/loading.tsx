export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fcfbf9] px-4 text-slate-600">
      <div className="flex items-center gap-3 rounded-xl border border-pink-100 bg-white px-5 py-4 text-sm font-semibold shadow-sm">
        <span className="material-symbols-outlined animate-spin text-pink-600">progress_activity</span>
        Loading page…
      </div>
    </div>
  );
}
