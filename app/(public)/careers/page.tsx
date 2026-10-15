"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

type Vacancy = {
  id: string;
  title: string;
  department: string;
  description: string | null;
  requirements: string | null;
  number_of_positions: number | null;
  salary_range: string | null;
  employment_type: string | null;
  work_arrangement: string | null;
  work_location: string | null;
  benefits: string | null;
  hiring_deadline: string | null;
};

export default function CareersPage() {
  const [jobs, setJobs] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/hr1/public-job-postings", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Unable to load vacancies.");
        if (active) setJobs(result.jobs ?? []);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Unable to load vacancies.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return (
    <main className="min-h-screen bg-[#F8F9FA] text-[#121212]">
      <header className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-8">
          <Link href="/careers" className="flex items-center gap-3">
            <Image src="/images/logo-remove-bg.png" alt="Airship Express" width={40} height={40} className="h-10 w-10 object-contain" />
            <span className="font-black">Airship Express Careers</span>
          </Link>
          <Link href="/application-status" className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-[#e5167e] hover:text-[#e5167e]">Check Status</Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#e5167e]">Careers Portal</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Open positions</h1>
        <p className="mt-3 max-w-2xl text-gray-600">Explore current vacancies approved by the requesting department and published by HR.</p>

        {loading && <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8 text-gray-500">Loading published vacancies…</div>}
        {!loading && error && <div role="alert" className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>}
        {!loading && !error && jobs.length === 0 && (
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8">
            <h2 className="font-bold">No published vacancies right now</h2>
            <p className="mt-2 text-sm text-gray-600">Please check again later. Only HR-approved and published positions appear here.</p>
          </div>
        )}
        {!loading && !error && jobs.length > 0 && (
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {jobs.map((job) => (
              <article key={job.id} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold">{job.title}</h2>
                    <p className="mt-1 text-sm font-medium text-[#e5167e]">{job.department}</p>
                  </div>
                  {job.employment_type && <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">{job.employment_type}</span>}
                </div>
                {job.description && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-700">{job.description}</p>}
                {job.requirements && <div className="mt-4"><h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">Qualifications</h3><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-gray-700">{job.requirements}</p></div>}
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  {job.work_arrangement && <div><dt className="text-xs text-gray-500">Work arrangement</dt><dd className="mt-1 font-medium">{job.work_arrangement}</dd></div>}
                  {job.work_location && <div><dt className="text-xs text-gray-500">Location</dt><dd className="mt-1 font-medium">{job.work_location}</dd></div>}
                  {job.salary_range && <div><dt className="text-xs text-gray-500">Salary range</dt><dd className="mt-1 font-medium">{job.salary_range}</dd></div>}
                  {job.hiring_deadline && <div><dt className="text-xs text-gray-500">Apply by</dt><dd className="mt-1 font-medium">{new Date(`${job.hiring_deadline}T00:00:00`).toLocaleDateString()}</dd></div>}
                  {job.number_of_positions && <div><dt className="text-xs text-gray-500">Openings</dt><dd className="mt-1 font-medium">{job.number_of_positions}</dd></div>}
                  {job.benefits && job.benefits.toLowerCase() !== "n/a" && <div className="col-span-2"><dt className="text-xs text-gray-500">Benefits</dt><dd className="mt-1 font-medium">{job.benefits}</dd></div>}
                </dl>
                <Link href={`/apply?position=${encodeURIComponent(job.id)}`} className="mt-6 inline-flex rounded-xl bg-[#e5167e] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#b3115f]">Apply for this position</Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
