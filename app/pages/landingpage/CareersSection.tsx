"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BriefcaseBusiness, MapPin } from "lucide-react";

type Vacancy = {
  id: string;
  title: string;
  department: string;
  description: string | null;
  employment_type: string | null;
  work_location: string | null;
};

export default function CareersSection() {
  const [jobs, setJobs] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;

    fetch("/api/hr1/public-job-postings", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error("Unable to load vacancies");
        if (active) setJobs((result.jobs ?? []).slice(0, 3));
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section id="careers" className="w-full bg-[#f7f7f8] px-6 py-20 dark:bg-[#17161a] sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Careers at Airship Express</span>
            <h2 className="mt-3 font-bricolage text-3xl font-extrabold tracking-tight text-ink dark:text-paper sm:text-5xl">Find your next opportunity</h2>
            <p className="mt-4 font-rethink text-base leading-7 text-muted dark:text-paper/60 sm:text-lg">
              Browse openings approved by the requesting department and published by HR.
            </p>
          </div>
          <Link href="/careers" className="inline-flex w-fit items-center gap-2 rounded-full bg-accent px-5 py-3 font-rethink text-sm font-semibold text-white transition hover:opacity-90">
            View all openings <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {loading ? (
          <div className="mt-9 rounded-2xl border border-line bg-white p-6 font-rethink text-sm text-muted dark:border-white/10 dark:bg-white/5 dark:text-paper/60" aria-live="polite">
            Loading published openings…
          </div>
        ) : error ? (
          <div className="mt-9 rounded-2xl border border-line bg-white p-6 dark:border-white/10 dark:bg-white/5">
            <p className="font-rethink text-sm text-muted dark:text-paper/60">Openings are temporarily unavailable. Please visit the careers page or check again shortly.</p>
            <Link href="/careers" className="mt-3 inline-flex font-rethink text-sm font-semibold text-accent hover:underline">Open Careers <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </div>
        ) : jobs.length === 0 ? (
          <div className="mt-9 rounded-2xl border border-line bg-white p-7 dark:border-white/10 dark:bg-white/5 sm:p-9">
            <div className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent"><BriefcaseBusiness className="h-5 w-5" /></span>
              <div>
                <h3 className="font-bricolage text-xl font-bold text-ink dark:text-paper">No published openings right now</h3>
                <p className="mt-2 max-w-2xl font-rethink text-sm leading-6 text-muted dark:text-paper/60">Only approved and published vacancies appear here. Check back later, or review the application guide and track an application you already submitted.</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link href="/careers" className="rounded-full border border-line px-4 py-2 font-rethink text-sm font-semibold text-ink transition hover:border-accent hover:text-accent dark:border-white/15 dark:text-paper">Careers page</Link>
                  <Link href="/application-guide" className="rounded-full border border-line px-4 py-2 font-rethink text-sm font-semibold text-ink transition hover:border-accent hover:text-accent dark:border-white/15 dark:text-paper">Application guide</Link>
                  <Link href="/application-status" className="rounded-full border border-line px-4 py-2 font-rethink text-sm font-semibold text-ink transition hover:border-accent hover:text-accent dark:border-white/15 dark:text-paper">Check application status</Link>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {jobs.map((job) => (
              <article key={job.id} className="flex flex-col rounded-2xl border border-line bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
                <p className="font-rethink text-xs font-semibold uppercase tracking-wide text-accent">{job.department}</p>
                <h3 className="mt-2 font-bricolage text-xl font-bold text-ink dark:text-paper">{job.title}</h3>
                {job.description && <p className="mt-3 line-clamp-3 font-rethink text-sm leading-6 text-muted dark:text-paper/60">{job.description}</p>}
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-muted dark:text-paper/60">
                  {job.employment_type && <span className="rounded-full bg-[#f3f4f6] px-3 py-1 dark:bg-white/10">{job.employment_type}</span>}
                  {job.work_location && <span className="inline-flex items-center gap-1 rounded-full bg-[#f3f4f6] px-3 py-1 dark:bg-white/10"><MapPin className="h-3 w-3" />{job.work_location}</span>}
                </div>
                <Link href={`/apply?position=${encodeURIComponent(job.id)}`} className="mt-6 inline-flex w-fit items-center gap-2 font-rethink text-sm font-semibold text-accent hover:underline">
                  Apply for this role <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            ))}
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line pt-6 font-rethink text-sm dark:border-white/10">
          <span className="text-muted dark:text-paper/50">Applicant resources</span>
          <Link href="/application-guide" className="font-medium text-ink hover:text-accent dark:text-paper">How to apply</Link>
          <Link href="/application-status" className="font-medium text-ink hover:text-accent dark:text-paper">Check application status</Link>
        </div>
      </div>
    </section>
  );
}
