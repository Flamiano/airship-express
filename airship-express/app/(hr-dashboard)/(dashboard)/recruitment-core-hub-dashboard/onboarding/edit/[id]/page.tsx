"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/app/(hr-dashboard)/supabase/client";

type Onboarding = {
  id: string;
  applicant_id: string;
  sss_submitted: boolean;
  philhealth_submitted: boolean;
  pagibig_submitted: boolean;
  tin_submitted: boolean;
  clearance_submitted: boolean;
  medical_submitted: boolean;
  training_completed: boolean;
  remarks: string | null;
  completed_at: string | null;
};

type Applicant = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
};

export default function EditOnboardingPage() {
  const router = useRouter();
  const params = useParams();
  const supabase = useMemo(() => createClient(), []);

  const onboardingId = params?.id as string;

  const [onboarding, setOnboarding] = useState<Onboarding | null>(null);
  const [applicant, setApplicant] = useState<Applicant | null>(null);

  const [sssSubmitted, setSssSubmitted] = useState(false);
  const [philhealthSubmitted, setPhilhealthSubmitted] = useState(false);
  const [pagibigSubmitted, setPagibigSubmitted] = useState(false);
  const [tinSubmitted, setTinSubmitted] = useState(false);
  const [clearanceSubmitted, setClearanceSubmitted] = useState(false);
  const [medicalSubmitted, setMedicalSubmitted] = useState(false);
  const [trainingCompleted, setTrainingCompleted] = useState(false);

  const [remarks, setRemarks] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadOnboarding() {
      if (!onboardingId) return;

      setLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from("hr1_onboardings")
          .select(`
            id,
            applicant_id,
            sss_submitted,
            philhealth_submitted,
            pagibig_submitted,
            tin_submitted,
            clearance_submitted,
            medical_submitted,
            training_completed,
            remarks,
            completed_at,
            hr1_applicants (
              id,
              first_name,
              last_name,
              email
            )
          `)
          .eq("id", onboardingId)
          .single();

        if (error) {
          console.error("ONBOARDING LOAD ERROR:", error);
          if (isMounted) {
            setError(`Unable to load onboarding: ${error.message}`);
          }
          return;
        }

        if (isMounted && data) {
          const onboardingData = data as unknown as Onboarding & {
            hr1_applicants: Applicant | null;
          };

          setOnboarding(onboardingData);
          setApplicant(onboardingData.hr1_applicants);

          setSssSubmitted(onboardingData.sss_submitted);
          setPhilhealthSubmitted(onboardingData.philhealth_submitted);
          setPagibigSubmitted(onboardingData.pagibig_submitted);
          setTinSubmitted(onboardingData.tin_submitted);
          setClearanceSubmitted(onboardingData.clearance_submitted);
          setMedicalSubmitted(onboardingData.medical_submitted);
          setTrainingCompleted(onboardingData.training_completed);

          setRemarks(onboardingData.remarks || "");
        }
      } catch (err: any) {
        console.error("ONBOARDING CATCH ERROR:", err);
        if (isMounted) {
          setError(`An unexpected error occurred: ${err.message || err}`);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadOnboarding();

    return () => {
      isMounted = false;
    };
  }, [onboardingId, supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError(null);

    try {
      const allCompleted =
        sssSubmitted &&
        philhealthSubmitted &&
        pagibigSubmitted &&
        tinSubmitted &&
        clearanceSubmitted &&
        medicalSubmitted &&
        trainingCompleted;

      const { error: updateError } = await supabase
        .from("hr1_onboardings")
        .update({
          sss_submitted: sssSubmitted,
          philhealth_submitted: philhealthSubmitted,
          pagibig_submitted: pagibigSubmitted,
          tin_submitted: tinSubmitted,
          clearance_submitted: clearanceSubmitted,
          medical_submitted: medicalSubmitted,
          training_completed: trainingCompleted,
          remarks: remarks.trim() || null,
          completed_at: allCompleted
            ? onboarding?.completed_at || new Date().toISOString()
            : null,
        })
        .eq("id", onboardingId);

      if (updateError) {
        console.error("ONBOARDING UPDATE ERROR:", updateError);
        setError(`Update failed: ${updateError.message}`);
        setSaving(false);
        return;
      }

      if (onboarding?.applicant_id) {
        const newApplicantStatus = allCompleted ? "Hired" : "Onboarding";

        const { error: applicantError } = await supabase
          .from("hr1_applicants")
          .update({
            status: newApplicantStatus,
          })
          .eq("id", onboarding.applicant_id);

        if (applicantError) {
          console.error("APPLICANT STATUS UPDATE ERROR:", applicantError);
          setError(
            `Onboarding was updated, but applicant status could not be updated: ${applicantError.message}`
          );
          setSaving(false);
          return;
        }
      }

      router.push("/recruitment-core-hub-dashboard/onboarding");
      router.refresh();
    } catch (err: any) {
      console.error("ONBOARDING SUBMIT CATCH ERROR:", err);
      setError(`Save failed: ${err.message || err}`);
      setSaving(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      "Are you sure you want to delete this onboarding record?"
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from("hr1_onboardings")
        .delete()
        .eq("id", onboardingId);

      if (deleteError) {
        console.error("ONBOARDING DELETE ERROR:", deleteError);
        setError(`Delete failed: ${deleteError.message}`);
        setDeleting(false);
        return;
      }

      if (onboarding?.applicant_id) {
        const { error: applicantError } = await supabase
          .from("hr1_applicants")
          .update({
            status: "Interview Passed",
          })
          .eq("id", onboarding.applicant_id);

        if (applicantError) {
          console.error("APPLICANT STATUS RESET ERROR:", applicantError);
        }
      }

      router.push("/recruitment-core-hub-dashboard/onboarding");
      router.refresh();
    } catch (err: any) {
      console.error("ONBOARDING DELETE CATCH ERROR:", err);
      setError(`Delete failed: ${err.message || err}`);
      setDeleting(false);
    }
  }

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
  const isAllCompleted = completedCount === checklist.length;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="relative flex h-12 w-12 items-center justify-center">
            <div className="absolute h-12 w-12 animate-ping rounded-full bg-[#E91E8F]/20 opacity-75" />
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#E91E8F] border-t-transparent" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-900">Loading onboarding details</p>
            <p className="mt-0.5 text-xs text-slate-500">Please wait while we fetch the candidate records...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!onboarding) {
    return (
      <main className="min-h-screen bg-[#F8FAFC]">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-12">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-8 ring-red-50/50">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-900 sm:text-xl">
              Record Not Found
            </h2>
            <p className="mx-auto mt-1.5 max-w-md text-xs text-slate-500 sm:text-sm">
              The onboarding record you are trying to edit does not exist or was removed.
            </p>

            {error && (
              <div className="mx-auto mt-4 max-w-md rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700">
                {error}
              </div>
            )}

            <div className="mt-6">
              <Link
                href="/recruitment-core-hub-dashboard/onboarding"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800"
              >
                ← Return to Onboarding
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] pb-16 text-[#0F172A]">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
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
              <p className="text-sm font-semibold leading-none text-slate-800">
                Super Admin
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Administrator
              </p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#E91E8F] to-[#f458ad] text-xs font-bold text-white shadow-sm ring-2 ring-white">
              SA
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 pt-6 sm:px-6 sm:pt-8">
        <Link
          href="/recruitment-core-hub-dashboard/onboarding"
          className="group mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-[#E91E8F]"
        >
          <svg className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Onboarding Overview
        </Link>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Edit Onboarding Record
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Manage status and requirements for this candidate.
            </p>
          </div>

          <div>
            {isAllCompleted ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-600" />
                Completed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3.5 py-1.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-600/20">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
                In Progress
              </span>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-8 p-6 sm:p-8">
            <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4 sm:p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-200 text-base font-bold text-slate-600">
                {applicant ? `${applicant.first_name[0]}${applicant.last_name[0]}` : "?"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:text-xs">
                  Target Applicant
                </p>
                <h3 className="truncate text-base font-bold text-slate-900">
                  {applicant ? `${applicant.first_name} ${applicant.last_name}` : "Unknown Applicant"}
                </h3>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {applicant?.email || "No email available"}
                </p>
              </div>
            </div>

            <div className="space-y-2.5 rounded-xl border border-slate-100 bg-slate-50/30 p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Completion Progress</span>
                <span className="font-bold text-[#E91E8F]">{completedCount} of 7 completed ({progressPercent}%)</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 p-0.5">
                <div
                  className="h-full rounded-full bg-[#E91E8F] transition-all duration-300 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Requirements Checklist
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Toggle documents and milestones as they are verified.
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
                        ? "border-[#E91E8F]/40 bg-[#E91E8F]/[0.02] shadow-xs"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                    }`}
                  >
                    <span className="text-xs font-semibold text-slate-800">{item.label}</span>
                    <input
                      id={item.id}
                      type="checkbox"
                      checked={item.state}
                      onChange={(e) => item.setter(e.target.checked)}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-[#E91E8F] accent-[#E91E8F] focus:ring-[#E91E8F]/20"
                    />
                  </label>
                ))}

                <label
                  htmlFor="training"
                  className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all sm:col-span-2 ${
                    trainingCompleted
                      ? "border-[#E91E8F]/40 bg-[#E91E8F]/[0.02] shadow-xs"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                  }`}
                >
                  <div className="flex flex-col pr-4">
                    <span className="text-xs font-semibold text-slate-800">
                      Training Completed
                    </span>
                    <span className="mt-0.5 text-[11px] text-slate-400">
                      Mandatory orientation and role training program
                    </span>
                  </div>
                  <input
                    id="training"
                    type="checkbox"
                    checked={trainingCompleted}
                    onChange={(e) => setTrainingCompleted(e.target.checked)}
                    className="h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-[#E91E8F] accent-[#E91E8F] focus:ring-[#E91E8F]/20"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="remarks" className="block text-xs font-bold text-slate-900">
                Notes & Remarks
              </label>
              <textarea
                id="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                placeholder="Add any additional notes, missing doc details, or observations..."
                className="w-full resize-y rounded-xl border border-slate-200 p-3 text-xs outline-none transition focus:border-[#E91E8F] focus:ring-2 focus:ring-[#E91E8F]/10 placeholder:text-slate-400"
              />
            </div>

            {error && (
              <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700">
                <svg className="h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || saving}
                className="inline-flex items-center justify-center rounded-xl border border-rose-200 px-4 py-2.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? "Deleting Record..." : "Delete Onboarding"}
              </button>

              <div className="flex items-center gap-2.5">
                <Link
                  href="/recruitment-core-hub-dashboard/onboarding"
                  className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 sm:flex-initial"
                >
                  Cancel
                </Link>

                <button
                  type="submit"
                  disabled={saving || deleting}
                  className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#E91E8F] px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#d8177f] focus:ring-4 focus:ring-[#E91E8F]/20 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-initial"
                >
                  {saving ? "Saving Changes..." : "Save Changes"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}