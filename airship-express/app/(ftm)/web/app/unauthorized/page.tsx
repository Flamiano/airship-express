"use client";

import { useRouter } from "next/navigation";

export default function UnauthorizedPage() {
  const router = useRouter();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fff7fc] px-6 py-12 text-center">
      <section className="max-w-md rounded-3xl border border-pink-200 bg-white p-8 shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-pink-100 text-xl text-[#b80049]">!</div>
        <h1 className="text-2xl font-black text-slate-900">Access denied</h1>
        <p className="mt-2 text-sm text-slate-600">Your assigned role does not have permission to access this FTM section.</p>
        <button type="button" onClick={() => router.back()} className="mt-6 rounded-xl bg-[#b80049] px-5 py-3 text-sm font-bold text-white hover:bg-[#96003b]">Go back</button>
      </section>
    </main>
  );
}
