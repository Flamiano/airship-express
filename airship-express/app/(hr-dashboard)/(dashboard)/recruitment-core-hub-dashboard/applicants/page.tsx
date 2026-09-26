"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, useMemo, useRef } from "react";
import { createClient } from "@/app/(hr-dashboard)/supabase/client";

type JobPosition = {
  title: string;
};

type Applicant = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  status: string;
  created_at: string;
  hr1_job_positions: JobPosition | JobPosition[] | null;
};

type ScreeningResult = {
  match_score: number;
  recommendation: string;
  strengths: string[];
  gaps: string[];
  summary: string;
};

export default function ApplicantsPage() {
  const supabase = createClient();
  const resultRef = useRef<HTMLDivElement | null>(null);

  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // AI SCREENING STATE
  const [screeningApplicantId, setScreeningApplicantId] = useState<string | null>(null);
  const [screeningResult, setScreeningResult] = useState<ScreeningResult | null>(null);
  const [screeningApplicantName, setScreeningApplicantName] = useState("");

  // ==========================================
  // FETCH APPLICANTS
  // ==========================================

  async function loadApplicants() {
    setLoading(true);
    setError("");

    try {
      const { data, error: fetchError } = await supabase
        .from("hr1_applicants")
        .select(`
          id,
          first_name,
          last_name,
          email,
          phone,
          status,
          created_at,
          hr1_job_positions (
            title
          )
        `)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      setApplicants((data as unknown as Applicant[]) || []);
    } catch (err: any) {
      console.error("APPLICANTS LOAD ERROR:", err);
      setError(`Unable to load applicant records: ${err?.message || "Unexpected error"}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadApplicants();
  }, []);

  // Helper function to extract position title
  function getPositionTitle(jobPositions: JobPosition | JobPosition[] | null): string {
    if (!jobPositions) return "Not assigned";
    if (Array.isArray(jobPositions)) {
      return jobPositions[0]?.title || "Not assigned";
    }
    return jobPositions.title || "Not assigned";
  }

  // ==========================================
  // AI SCREENING
  // ==========================================

  async function handleAIScreening(applicant: Applicant) {
    setError("");
    setScreeningApplicantId(applicant.id);
    setScreeningResult(null);
    setScreeningApplicantName(`${applicant.first_name || ""} ${applicant.last_name || ""}`.trim());

    try {
      const response = await fetch("/api/screening", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicant_id: applicant.id }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "AI screening failed. Please try again.");
      }

      setScreeningResult(result.screening);

      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (err: any) {
      console.error("AI SCREENING ERROR:", err);
      setError(err?.message || "Unable to connect to the AI screening service.");
    } finally {
      setScreeningApplicantId(null);
    }
  }

  // ==========================================
  // DELETE APPLICANT
  // ==========================================

  async function handleDeleteApplicant(applicantId: string) {
    const applicant = applicants.find((item) => item.id === applicantId);
    const candidateName = applicant 
      ? `${applicant.first_name || ""} ${applicant.last_name || ""}`.trim() 
      : "this applicant";

    if (!window.confirm(`Are you sure you want to delete ${candidateName}?`)) {
      return;
    }

    setError("");

    try {
      const { error: deleteError } = await supabase
        .from("hr1_applicants")
        .delete()
        .eq("id", applicantId);

      if (deleteError) throw deleteError;

      setApplicants((prev) => prev.filter((item) => item.id !== applicantId));
    } catch (err: any) {
      console.error("APPLICANT DELETE ERROR:", err);
      setError(`Delete failed: ${err.message}`);
    }
  }

  // ==========================================
  // FILTERING LOGIC
  // ==========================================

  const filteredApplicants = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return applicants.filter((applicant) => {
      const fullName = `${applicant.first_name || ""} ${applicant.last_name || ""}`.toLowerCase();
      const email = (applicant.email || "").toLowerCase();

      const matchesSearch = fullName.includes(query) || email.includes(query);
      const matchesStatus = statusFilter === "ALL" || applicant.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [applicants, searchQuery, statusFilter]);

  // ==========================================
  // STATUS BADGE STYLING
  // ==========================================

  function getStatusClass(status: string) {
    switch (status) {
      case "Pending":
        return "bg-gray-100 text-gray-700 ring-gray-200";
      case "Under Review":
        return "bg-blue-50 text-blue-700 ring-blue-200";
      case "Shortlisted":
        return "bg-indigo-50 text-indigo-700 ring-indigo-200";
      case "Interview Scheduled":
        return "bg-purple-50 text-purple-700 ring-purple-200";
      case "Passed Interview":
        return "bg-emerald-50 text-emerald-700 ring-emerald-200";
      case "Failed Interview":
      case "Rejected":
        return "bg-red-50 text-red-700 ring-red-200";
      case "Rescheduled":
        return "bg-amber-50 text-amber-700 ring-amber-200";
      case "For Onboarding":
      case "Hired":
        return "bg-green-100 text-green-800 ring-green-300";
      default:
        return "bg-gray-100 text-gray-700 ring-gray-200";
    }
  }

  return (
    <main className="min-h-screen bg-[#F8F9FA] pb-16">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <Image
              src="/images/logo.jpg"
              alt="Logo"
              width={40}
              height={40}
              priority
              className="h-10 w-auto object-contain rounded-md"
            />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Human Resource Department
              </p>
              <h1 className="text-lg sm:text-xl font-black text-[#121212]">
                Recruitment & Applicant Portal
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-bold text-[#121212]">Super Admin</p>
              <p className="text-[10px] text-gray-400">HR Administrator</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#CB1A8E] text-xs font-black text-white shadow-sm ring-2 ring-[#CB1A8E]/20">
              SA
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-8 space-y-6">
        {/* Title Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-[#121212]">Applicants</h2>
            <p className="mt-1 text-xs text-gray-500">
              Manage candidate profiles, review AI match analysis, and track recruitment progress seamlessly.
            </p>
          </div>

          <Link
            href="/recruitment-core-hub-dashboard/applicants/new"
            className="inline-flex items-center justify-center rounded-xl bg-[#CB1A8E] px-5 py-2.5 text-xs font-bold text-white shadow-sm shadow-[#CB1A8E]/20 transition-all hover:bg-[#a31270] active:scale-[0.98]"
          >
            + Add Applicant
          </Link>
        </div>

        {/* Global Error Notice */}
        {error && (
          <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700 shadow-sm">
            <span>{error}</span>
            <button 
              type="button"
              onClick={() => setError("")} 
              className="font-bold text-red-500 hover:text-red-700 focus:outline-none"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}

        {/* Table Container */}
        <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm">
          {/* Controls Header */}
          <div className="flex flex-col gap-3.5 border-b border-gray-100 px-4 sm:px-6 py-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col sm:flex-row flex-1 items-stretch sm:items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="Search by candidate name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50/50 pl-10 pr-3.5 py-2 text-xs text-gray-800 outline-none transition focus:bg-white focus:border-[#CB1A8E] focus:ring-2 focus:ring-[#CB1A8E]/15 placeholder:text-gray-400"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-2 text-xs text-gray-800 outline-none transition focus:bg-white focus:border-[#CB1A8E] focus:ring-2 focus:ring-[#CB1A8E]/15"
              >
                <option value="ALL">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Under Review">Under Review</option>
                <option value="Shortlisted">Shortlisted</option>
                <option value="Interview Scheduled">Interview Scheduled</option>
                <option value="Passed Interview">Passed Interview</option>
                <option value="Hired">Hired</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            <button
              type="button"
              onClick={loadApplicants}
              disabled={loading}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-600 transition hover:bg-gray-50 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <svg className="h-3.5 w-3.5 animate-spin text-[#CB1A8E]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Refreshing...</span>
                </>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Refresh List</span>
                </>
              )}
            </button>
          </div>

          {/* Loading View */}
          {loading && (
            <div className="flex min-h-[320px] items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-50 text-[#CB1A8E]">
                  <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-gray-500">Loading applicant data...</p>
              </div>
            </div>
          )}

          {/* Empty View */}
          {!loading && filteredApplicants.length === 0 && (
            <div className="flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-50/80 text-2xl shadow-sm">
                👤
              </div>
              <h3 className="text-sm font-bold text-[#121212]">No applicant records found</h3>
              <p className="mt-1 max-w-sm text-xs text-gray-400 leading-relaxed">
                {searchQuery || statusFilter !== "ALL"
                  ? "Try adjusting your search criteria or reset your status filters to view all entries."
                  : "Start encoding candidate applications into the system to manage recruitment progress."}
              </p>
              {!searchQuery && statusFilter === "ALL" && (
                <Link
                  href="/recruitment-core-hub-dashboard/applicants/new"
                  className="mt-5 rounded-xl bg-[#CB1A8E] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#a31270]"
                >
                  Add First Applicant
                </Link>
              )}
            </div>
          )}

          {/* Data Table */}
          {!loading && filteredApplicants.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-gray-100 bg-gray-50/75 uppercase tracking-wider text-gray-400 font-semibold">
                  <tr>
                    <th className="px-6 py-3.5">Candidate</th>
                    <th className="px-6 py-3.5">Applied Position</th>
                    <th className="px-6 py-3.5">Contact Email</th>
                    <th className="px-6 py-3.5">Phone</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Date Added</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                  {filteredApplicants.map((applicant) => (
                    <tr key={applicant.id} className="transition-colors hover:bg-gray-50/60">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[11px] font-bold text-gray-600">
                            {applicant.first_name?.[0] || ""}{applicant.last_name?.[0] || ""}
                          </div>
                          <span className="font-bold text-[#121212] whitespace-nowrap">
                            {applicant.first_name} {applicant.last_name}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                        {getPositionTitle(applicant.hr1_job_positions)}
                      </td>

                      <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{applicant.email || "N/A"}</td>

                      <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{applicant.phone || "N/A"}</td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${getStatusClass(
                            applicant.status
                          )}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-75"></span>
                          {applicant.status || "Pending"}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-gray-400 whitespace-nowrap">
                        {applicant.created_at
                          ? new Date(applicant.created_at).toLocaleDateString("en-PH", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "N/A"}
                      </td>

                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <Link
                            href={`/recruitment-core-hub-dashboard/applicants/${applicant.id}/edit`}
                            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
                          >
                            Edit
                          </Link>

                          <button
                            type="button"
                            onClick={() => handleAIScreening(applicant)}
                            disabled={screeningApplicantId === applicant.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
                          >
                            {screeningApplicantId === applicant.id ? (
                              <>
                                <svg className="h-3 w-3 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                <span>Screening...</span>
                              </>
                            ) : (
                              "AI Screen"
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteApplicant(applicant.id)}
                            className="rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-600 shadow-sm transition hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* AI Screening Result View */}
        {screeningResult && (
          <div ref={resultRef} className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
                  AI Candidate Screening Evaluation
                </span>
                <h3 className="mt-2 text-xl font-black text-[#121212]">{screeningApplicantName}</h3>
              </div>

              <button
                type="button"
                onClick={() => {
                  setScreeningResult(null);
                  setScreeningApplicantName("");
                }}
                className="self-start sm:self-auto rounded-xl border border-gray-200 px-3.5 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-50 transition"
              >
                Close Summary
              </button>
            </div>

            {/* Score Cards */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-blue-50/70 p-4 border border-blue-100">
                <p className="text-xs font-semibold text-blue-700">Role Match Score</p>
                <p className="mt-1 text-3xl font-black text-blue-900">
                  {screeningResult.match_score ?? 0}%
                </p>
              </div>

              <div className="rounded-xl bg-emerald-50/70 p-4 border border-emerald-100">
                <p className="text-xs font-semibold text-emerald-700">AI Recommendation</p>
                <p className="mt-1 text-lg font-bold text-emerald-900">
                  {screeningResult.recommendation || "N/A"}
                </p>
              </div>
            </div>

            {/* Summary Text */}
            <div className="mt-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Evaluation Summary
              </h4>
              <p className="mt-1.5 text-xs leading-relaxed text-gray-700 bg-gray-50 p-4 rounded-xl border border-gray-100">
                {screeningResult.summary || "No summary provided."}
              </p>
            </div>

            {/* Strengths & Gaps */}
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div>
                <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                  Key Strengths
                </h4>
                <ul className="mt-2.5 space-y-2">
                  {(screeningResult.strengths || []).map((item, index) => (
                    <li key={`strength-${index}`} className="rounded-xl bg-emerald-50/80 border border-emerald-100 px-3.5 py-2.5 text-xs text-emerald-900 font-medium">
                      ✓ {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                  Identified Gaps
                </h4>
                <ul className="mt-2.5 space-y-2">
                  {(screeningResult.gaps || []).map((item, index) => (
                    <li key={`gap-${index}`} className="rounded-xl bg-amber-50/80 border border-amber-100 px-3.5 py-2.5 text-xs text-amber-900 font-medium">
                      • {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}