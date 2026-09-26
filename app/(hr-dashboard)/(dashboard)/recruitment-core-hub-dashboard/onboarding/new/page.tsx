"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/(hr-dashboard)/supabase/client";

type Applicant = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
};

export default function NewOnboardingPage() {
  const router = useRouter();

  const supabase = useMemo(() => createClient(), []);

  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loadingApplicants, setLoadingApplicants] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [applicantId, setApplicantId] = useState("");

  const [sssSubmitted, setSssSubmitted] = useState(false);
  const [philhealthSubmitted, setPhilhealthSubmitted] = useState(false);
  const [pagibigSubmitted, setPagibigSubmitted] = useState(false);
  const [tinSubmitted, setTinSubmitted] = useState(false);
  const [clearanceSubmitted, setClearanceSubmitted] = useState(false);
  const [medicalSubmitted, setMedicalSubmitted] = useState(false);
  const [trainingCompleted, setTrainingCompleted] = useState(false);

  const [remarks, setRemarks] = useState("");

  // ==========================================
  // LOAD APPLICANTS READY FOR ONBOARDING
  // ==========================================

  useEffect(() => {
    let isMounted = true;

    async function loadApplicants() {
      try {
        setLoadingApplicants(true);
        setError("");

        const { data, error: fetchError } = await supabase
          .from("hr1_applicants")
          .select("id, first_name, last_name, email, status")
          .eq("status", "Interview Passed")
          .order("first_name", { ascending: true });

        if (fetchError) throw fetchError;

        if (isMounted) {
          setApplicants(data ?? []);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error("ONBOARDING APPLICANTS LOAD ERROR:", err);
          setError(`Unable to load applicants: ${err?.message || "Unknown error"}`);
        }
      } finally {
        if (isMounted) {
          setLoadingApplicants(false);
        }
      }
    }

    loadApplicants();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  // ==========================================
  // SUBMIT
  // ==========================================

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError("");

    try {
      if (!applicantId) {
        setError("Please select an applicant.");
        setSaving(false);
        return;
      }

      // Check applicant status
      const { data: applicant, error: applicantCheckError } = await supabase
        .from("hr1_applicants")
        .select("id, status")
        .eq("id", applicantId)
        .single();

      if (applicantCheckError || !applicant) {
        setError(applicantCheckError?.message || "Applicant could not be found.");
        setSaving(false);
        return;
      }

      if (applicant.status !== "Interview Passed") {
        setError("Only applicants who passed the interview can start onboarding.");
        setSaving(false);
        return;
      }

      // Check existing onboarding record
      const { data: existingOnboarding, error: existingError } = await supabase
        .from("hr1_onboardings")
        .select("id")
        .eq("applicant_id", applicantId)
        .maybeSingle();

      if (existingError) {
        setError(`Unable to check existing onboarding: ${existingError.message}`);
        setSaving(false);
        return;
      }

      if (existingOnboarding) {
        setError("This applicant already has an onboarding record.");
        setSaving(false);
        return;
      }

      const allCompleted =
        sssSubmitted &&
        philhealthSubmitted &&
        pagibigSubmitted &&
        tinSubmitted &&
        clearanceSubmitted &&
        medicalSubmitted &&
        trainingCompleted;

      // Create onboarding record
      const { error: onboardingError } = await supabase
        .from("hr1_onboardings")
        .insert({
          applicant_id: applicantId,
          sss_submitted: sssSubmitted,
          philhealth_submitted: philhealthSubmitted,
          pagibig_submitted: pagibigSubmitted,
          tin_submitted: tinSubmitted,
          clearance_submitted: clearanceSubmitted,
          medical_submitted: medicalSubmitted,
          training_completed: trainingCompleted,
          remarks: remarks.trim() || null,
          completed_at: allCompleted ? new Date().toISOString() : null,
        });

      if (onboardingError) {
        setError(`Save failed: ${onboardingError.message}`);
        setSaving(false);
        return;
      }

      // Update applicant status
      const { error: applicantUpdateError } = await supabase
        .from("hr1_applicants")
        .update({ status: "Onboarding" })
        .eq("id", applicantId);

      if (applicantUpdateError) {
        setError(
          `Onboarding was saved, but applicant status could not be updated: ${applicantUpdateError.message}`
        );
        setSaving(false);
        return;
      }

      router.push("/recruitment-core-hub-dashboard/onboarding");
      router.refresh();
    } catch (err: any) {
      console.error("SUBMIT ERROR:", err);
      setError(`An unexpected error occurred: ${err?.message || "Unknown error"}`);
      setSaving(false);
    }
  }

  // Calculate live progress
  const checklist = [
    sssSubmitted,
    philhealthSubmitted,
    pagibigSubmitted,
    tinSubmitted,
    clearanceSubmitted,
    medicalSubmitted,
    trainingCompleted,
  ];
  const completedCount = checklist.filter(Boolean).length;
  const progressPercent = Math.round((completedCount / checklist.length) * 100);

  return (
    <main className="min-h-screen bg-[#F8FAFC] pb-16 text-[#0F172A]">
      {/* HEADER */}
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E91E8F]/10 text-[#E91E8F]">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:text-xs">
                Human Resource Department
              </span>
              <h1 className="text-base font-bold leading-tight tracking-tight text-slate-900 sm:text-lg">
                Recruitment & Employee Records
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 border-l border-slate-100 pl-3 sm:pl-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-none text-slate-800">Super Admin</p>
              <p className="mt-1 text-xs text-slate-400">Administrator</p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#E91E8F] to-[#f458ad] text-xs font-bold text-white shadow-sm ring-2 ring-white">
              SA
            </div>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <div className="mx-auto max-w-3xl px-4 pt-6 sm:px-6 sm:pt-8">
        <Link
          href="/recruitment-core-hub-dashboard/onboarding"
          className="group mb-6 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 transition-colors hover:text-[#E91E8F]"
        >
          <svg className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Onboarding
        </Link>

        <div className="mb-6">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Start New Hire Onboarding
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Create an onboarding record and track the applicant&apos;s requirements.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-8 p-6 sm:p-8">
            {/* APPLICANT SELECTION */}
            <div className="space-y-2">
              <label htmlFor="applicant" className="block text-xs font-bold uppercase tracking-wider text-slate-900">
                Select Candidate
              </label>

              {loadingApplicants ? (
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#E91E8F] border-t-transparent" />
                  <p className="text-xs font-medium text-slate-500">Loading applicants...</p>
                </div>
              ) : applicants.length === 0 ? (
                <div className="flex items-center gap-3 rounded-xl border border-amber-200/60 bg-amber-50 p-4 text-xs font-medium text-amber-800">
                  <svg className="h-5 w-5 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>No applicants are currently ready for onboarding (must have &ldquo;Interview Passed&rdquo; status).</span>
                </div>
              ) : (
                <div className="relative">
                  <select
                    id="applicant"
                    value={applicantId}
                    onChange={(event) => setApplicantId(event.target.value)}
                    required
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-medium text-slate-800 outline-none transition focus:border-[#E91E8F] focus:ring-4 focus:ring-[#E91E8F]/10"
                  >
                    <option value="">Select an applicant...</option>
                    {applicants.map((applicant) => (
                      <option key={applicant.id} value={applicant.id}>
                        {applicant.first_name} {applicant.last_name} — {applicant.email}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              )}
            </div>

            {/* PROGRESS BAR */}
            <div className="space-y-2 border-t border-slate-100 pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Initial Checklist Progress</span>
                <span className="font-bold text-[#E91E8F]">
                  {completedCount} of {checklist.length} selected ({progressPercent}%)
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-[#E91E8F] transition-all duration-300 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* REQUIREMENTS CHECKBOXES */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Onboarding Requirements</h3>
                <p className="text-xs text-slate-500">
                  Check each requirement once it has been submitted or completed.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { id: "sss", label: "SSS Submitted", state: sssSubmitted, setter: setSssSubmitted },
                  { id: "philhealth", label: "PhilHealth Submitted", state: philhealthSubmitted, setter: setPhilhealthSubmitted },
                  { id: "pagibig", label: "Pag-IBIG Submitted", state: pagibigSubmitted, setter: setPagibigSubmitted },
                  { id: "tin", label: "TIN Submitted", state: tinSubmitted, setter: setTinSubmitted },
                  { id: "clearance", label: "Clearance Submitted", state: clearanceSubmitted, setter: setClearanceSubmitted },
                  { id: "medical", label: "Medical Submitted", state: medicalSubmitted, setter: setMedicalSubmitted },
                ].map((item) => (
                  <label
                    key={item.id}
                    htmlFor={item.id}
                    className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all ${
                      item.state
                        ? "border-[#E91E8F]/40 bg-[#E91E8F]/[0.02] shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                    }`}
                  >
                    <span className="text-xs font-semibold text-slate-800">{item.label}</span>
                    <input
                      id={item.id}
                      type="checkbox"
                      checked={item.state}
                      onChange={(e) => item.setter(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-[#E91E8F] accent-[#E91E8F] focus:ring-[#E91E8F]/20"
                    />
                  </label>
                ))}

                {/* Training (Full Width) */}
                <label
                  htmlFor="training"
                  className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all sm:col-span-2 ${
                    trainingCompleted
                      ? "border-[#E91E8F]/40 bg-[#E91E8F]/[0.02] shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-slate-800">Training Completed</span>
                    <span className="text-[11px] text-slate-400">
                      Mandatory orientation and role training program
                    </span>
                  </div>
                  <input
                    id="training"
                    type="checkbox"
                    checked={trainingCompleted}
                    onChange={(e) => setTrainingCompleted(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#E91E8F] accent-[#E91E8F] focus:ring-[#E91E8F]/20"
                  />
                </label>
              </div>
            </div>

            {/* REMARKS */}
            <div className="space-y-2">
              <label htmlFor="remarks" className="block text-xs font-bold text-slate-900">
                Remarks & Notes
              </label>
              <textarea
                id="remarks"
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                rows={3}
                placeholder="Enter onboarding notes or remarks..."
                className="w-full rounded-xl border border-slate-200 p-3 text-xs outline-none transition focus:border-[#E91E8F] focus:ring-4 focus:ring-[#E91E8F]/10 placeholder:text-slate-400"
              />
            </div>

            {/* STATUS INFORMATION */}
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
              <p className="text-xs font-bold text-blue-900">Onboarding Status Behavior</p>
              <p className="mt-1 text-xs leading-relaxed text-blue-700/80">
                New onboarding records start as <strong className="font-semibold text-blue-900">In Progress</strong>.
                Once all requirements above are completed, the record will automatically update to{" "}
                <strong className="font-semibold text-blue-900">Completed</strong>.
              </p>
            </div>

            {/* ERROR ALERT */}
            {error && (
              <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700">
                <svg className="h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* ACTIONS */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-6">
              <Link
                href="/recruitment-core-hub-dashboard/onboarding"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving || loadingApplicants || applicants.length === 0}
                className="inline-flex items-center justify-center rounded-xl bg-[#E91E8F] px-5 py-2.5 text-xs font-semibold text-white shadow-sm shadow-[#E91E8F]/30 transition hover:bg-[#d8177f] focus:outline-none focus:ring-4 focus:ring-[#E91E8F]/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving..." : "Start Onboarding"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}