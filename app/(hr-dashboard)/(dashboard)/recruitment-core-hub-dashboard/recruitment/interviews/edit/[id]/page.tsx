"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/(hr-dashboard)/supabase/client";

type Applicant = {
  id: string;
  first_name: string;
  last_name: string;
};

type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: string;
};

type Interview = {
  id: string;
  applicant_id: string;
  interviewer_id: string | null;
  scheduled_date: string;
  location_or_link: string | null;
  status: string;
  rating: number | null;
  feedback: string | null;
  outcome: string | null;
};

interface EditInterviewPageProps {
  params: Promise<{ id: string }>;
}

export default function EditInterviewPage({ params }: EditInterviewPageProps) {
  // Unwrap async params for Next.js 15/16 compatibility
  const resolvedParams = use(params);
  const interviewId = resolvedParams.id;

  const router = useRouter();
  const supabase = createClient();

  // ==========================================
  // STATE MANAGEMENT
  // ==========================================

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const [applicantId, setApplicantId] = useState("");
  const [interviewerId, setInterviewerId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [locationOrLink, setLocationOrLink] = useState("");

  const [status, setStatus] = useState("Scheduled");
  const [rating, setRating] = useState("");
  const [feedback, setFeedback] = useState("");
  const [outcome, setOutcome] = useState("Pending");

  // ==========================================
  // LOAD INTERVIEW DETAILS
  // ==========================================

  useEffect(() => {
    async function loadInterview() {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from("hr1_interviews")
          .select(`
            id,
            applicant_id,
            interviewer_id,
            scheduled_date,
            location_or_link,
            status,
            rating,
            feedback,
            outcome
          `)
          .eq("id", interviewId)
          .single();

        if (fetchError || !data) {
          throw fetchError || new Error("Interview record not found.");
        }

        const interview = data as Interview;

        setApplicantId(interview.applicant_id);
        setInterviewerId(interview.interviewer_id || "");

        // Convert database ISO string to local HTML datetime-local format
        if (interview.scheduled_date) {
          const date = new Date(interview.scheduled_date);
          const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
          setScheduledDate(localDate);
        }

        setLocationOrLink(interview.location_or_link || "");
        setStatus(interview.status || "Scheduled");
        setRating(interview.rating !== null ? String(interview.rating) : "");
        setFeedback(interview.feedback || "");
        setOutcome(interview.outcome || "Pending");
      } catch (err: any) {
        console.error("INTERVIEW LOAD ERROR:", err);
        setError(err?.message || "Failed to load interview record.");
      } finally {
        setLoading(false);
      }
    }

    if (interviewId) {
      loadInterview();
    }
  }, [interviewId]);

  // ==========================================
  // LOAD APPLICANTS & PROFILES
  // ==========================================

  useEffect(() => {
    async function loadDropdowns() {
      try {
        const [applicantsRes, profilesRes] = await Promise.all([
          supabase.from("hr1_applicants").select("id, first_name, last_name").order("first_name"),
          supabase.from("hr1_profiles").select("id, full_name, email, role").order("full_name"),
        ]);

        if (applicantsRes.error) console.error("APPLICANTS LOAD ERROR:", applicantsRes.error);
        if (profilesRes.error) console.error("PROFILES LOAD ERROR:", profilesRes.error);

        setApplicants(applicantsRes.data || []);
        setProfiles(profilesRes.data || []);
      } catch (err) {
        console.error("DROPDOWN LOAD ERROR:", err);
      }
    }

    loadDropdowns();
  }, []);

  // ==========================================
  // FORM SUBMISSION
  // ==========================================

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError(null);

    // ------------------------------------------
    // VALIDATIONS
    // ------------------------------------------

    if (!applicantId) {
      setError("Please select an applicant.");
      setSaving(false);
      return;
    }

    if (!interviewerId) {
      setError("Please select an interviewer.");
      setSaving(false);
      return;
    }

    if (!scheduledDate) {
      setError("Please select the interview date and time.");
      setSaving(false);
      return;
    }

    // Validate Rating
    let ratingValue: number | null = null;
    if (rating !== "") {
      const parsedRating = Number(rating);
      if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
        setError("Rating must be a whole number from 1 to 5.");
        setSaving(false);
        return;
      }
      ratingValue = parsedRating;
    }

    // Validate Status & Outcome Matrix
    if (status !== "Completed" && outcome !== "Pending") {
      setError("Passed or Failed outcome can only be selected for a completed interview.");
      setSaving(false);
      return;
    }

    if (status === "Completed") {
      if (outcome === "Pending") {
        setError("A completed interview must have a Passed or Failed outcome.");
        setSaving(false);
        return;
      }

      if (ratingValue === null) {
        setError("Please provide a rating from 1 to 5 for a completed interview.");
        setSaving(false);
        return;
      }
    }

    // ------------------------------------------
    // SAVE INTERVIEW
    // ------------------------------------------

    try {
      const { error: updateError } = await supabase
        .from("hr1_interviews")
        .update({
          applicant_id: applicantId,
          interviewer_id: interviewerId,
          scheduled_date: new Date(scheduledDate).toISOString(),
          location_or_link: locationOrLink || null,
          status,
          rating: ratingValue,
          feedback: feedback || null,
          outcome,
        })
        .eq("id", interviewId);

      if (updateError) throw updateError;

      // ------------------------------------------
      // UPDATE APPLICANT STATUS
      // ------------------------------------------

      let applicantStatus = "Interview Scheduled";

      if (status === "Completed") {
        if (outcome === "Passed") {
          applicantStatus = "Interview Passed";
        } else if (outcome === "Failed") {
          applicantStatus = "Interview Failed";
        }
      }

      const { error: applicantError } = await supabase
        .from("hr1_applicants")
        .update({ status: applicantStatus })
        .eq("id", applicantId);

      if (applicantError) {
        console.error("APPLICANT STATUS UPDATE ERROR:", applicantError);
        setError(`Interview saved, but applicant status could not be updated: ${applicantError.message}`);
        setSaving(false);
        return;
      }

      // Success redirect
      router.push("/recruitment-core-hub-dashboard/recruitment/interviews");
      router.refresh();
    } catch (err: any) {
      console.error("SAVE ERROR:", err);
      setError(`Save failed: ${err?.message || "Unexpected error"}`);
      setSaving(false);
    }
  }

  // Handle status change side-effects
  function handleStatusChange(newStatus: string) {
    setStatus(newStatus);
    if (newStatus === "Completed" && outcome === "Pending") {
      setOutcome("Passed");
    } else if (newStatus !== "Completed") {
      setOutcome("Pending");
    }
  }

  // ==========================================
  // RENDER LOADING STATE
  // ==========================================

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F8F9FA] pb-16">
        <header className="sticky top-0 z-25 border-b border-gray-200 bg-white/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-4">
            <div>
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-400">
                Human Resource Department
              </p>
              <h1 className="text-base sm:text-xl font-black text-[#121212]">
                Recruitment & Applicant Portal
              </h1>
            </div>
          </div>
        </header>

        <div className="mx-auto flex min-h-[400px] max-w-4xl items-center justify-center px-4 sm:px-6">
          <div className="flex flex-col items-center gap-3">
            <div className="relative flex h-12 w-12 items-center justify-center">
              <div className="absolute h-12 w-12 animate-ping rounded-full bg-[#CB1A8E]/10 opacity-75" />
              <svg className="h-7 w-7 animate-spin text-[#CB1A8E]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <p className="text-xs font-semibold text-gray-500">Loading interview details...</p>
          </div>
        </div>
      </main>
    );
  }

  // ==========================================
  // RENDER PAGE FORM
  // ==========================================

  return (
    <main className="min-h-screen bg-[#F8F9FA] pb-16">
      {/* Top Header */}
      <header className="sticky top-0 z-25 border-b border-gray-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-4">
          <div>
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-400">
              Human Resource Department
            </p>
            <h1 className="text-base sm:text-xl font-black text-[#121212]">
              Recruitment & Applicant Portal
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-bold text-[#121212]">Super Admin</p>
              <p className="text-[10px] text-gray-400">HR Administrator</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#CB1A8E] text-xs font-black text-white shadow-sm ring-2 ring-pink-50">
              SA
            </div>
          </div>
        </div>
      </header>

      {/* Main Form Container */}
      <div className="mx-auto max-w-3xl px-4 sm:px-6 pt-6 sm:pt-8">
        <Link
          href="/recruitment-core-hub-dashboard/recruitment/interviews"
          className="inline-flex items-center text-xs font-bold text-[#CB1A8E] hover:underline"
        >
          ← Back to Interviews
        </Link>

        <div className="mb-6 mt-3">
          <h2 className="text-xl sm:text-2xl font-black text-[#121212]">Edit Interview</h2>
          <p className="mt-1 text-xs text-gray-500">
            Update scheduling details, evaluate candidate performance, and record final results.
          </p>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-red-100 bg-red-50 p-4 text-xs font-semibold text-red-700">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="font-bold text-red-500 hover:text-red-700">
              ✕
            </button>
          </div>
        )}

        {/* Form Card */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 sm:p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Applicant Select */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-gray-700">
                Applicant <span className="text-red-500">*</span>
              </label>
              <select
                value={applicantId}
                onChange={(e) => setApplicantId(e.target.value)}
                required
                className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs text-gray-800 outline-none transition focus:border-[#CB1A8E] focus:ring-2 focus:ring-[#CB1A8E]/15"
              >
                <option value="">Select an applicant</option>
                {applicants.map((applicant) => (
                  <option key={applicant.id} value={applicant.id}>
                    {applicant.first_name} {applicant.last_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Interviewer Select */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-gray-700">
                Interviewer <span className="text-red-500">*</span>
              </label>
              <select
                value={interviewerId}
                onChange={(e) => setInterviewerId(e.target.value)}
                required
                className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs text-gray-800 outline-none transition focus:border-[#CB1A8E] focus:ring-2 focus:ring-[#CB1A8E]/15"
              >
                <option value="">Select an interviewer</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.full_name} ({profile.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Date & Time Input */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-gray-700">
                Interview Date & Time <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                required
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 outline-none transition focus:border-[#CB1A8E] focus:ring-2 focus:ring-[#CB1A8E]/15"
              />
            </div>

            {/* Location / Link Input */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-gray-700">
                Location or Meeting Link
              </label>
              <input
                type="text"
                value={locationOrLink}
                onChange={(e) => setLocationOrLink(e.target.value)}
                placeholder="e.g. Conference Room A or https://meet.google.com/xyz"
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 outline-none transition focus:border-[#CB1A8E] focus:ring-2 focus:ring-[#CB1A8E]/15 placeholder:text-gray-400"
              />
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {/* Status Select */}
              <div>
                <label className="mb-1.5 block text-xs font-bold text-gray-700">
                  Interview Status
                </label>
                <select
                  value={status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs text-gray-800 outline-none transition focus:border-[#CB1A8E] focus:ring-2 focus:ring-[#CB1A8E]/15"
                >
                  <option value="Scheduled">Scheduled</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="Reschedule">Rescheduled</option>
                </select>
              </div>

              {/* Outcome Select */}
              <div>
                <label className="mb-1.5 block text-xs font-bold text-gray-700">
                  Interview Outcome
                </label>
                <select
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  disabled={status !== "Completed"}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs text-gray-800 outline-none transition focus:border-[#CB1A8E] focus:ring-2 focus:ring-[#CB1A8E]/15 disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <option value="Pending">Pending</option>
                  <option value="Passed">Passed</option>
                  <option value="Failed">Failed</option>
                </select>
              </div>
            </div>

            {/* Rating Select */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-gray-700">
                Score / Rating {status === "Completed" && <span className="text-red-500">*</span>}
              </label>
              <select
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs text-gray-800 outline-none transition focus:border-[#CB1A8E] focus:ring-2 focus:ring-[#CB1A8E]/15"
              >
                <option value="">No rating evaluated</option>
                <option value="1">★☆☆☆☆ (1 / 5 - Poor)</option>
                <option value="2">★★☆☆☆ (2 / 5 - Fair)</option>
                <option value="3">★★★☆☆ (3 / 5 - Good)</option>
                <option value="4">★★★★☆ (4 / 5 - Very Good)</option>
                <option value="5">★★★★★ (5 / 5 - Outstanding)</option>
              </select>
            </div>

            {/* Feedback Textarea */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-gray-700">
                Interviewer Feedback & Notes
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={5}
                placeholder="Enter candidate strengths, weaknesses, and key interview takeaways..."
                className="w-full rounded-xl border border-gray-200 p-3.5 text-xs text-gray-800 outline-none transition focus:border-[#CB1A8E] focus:ring-2 focus:ring-[#CB1A8E]/15 placeholder:text-gray-400"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 border-t border-gray-100 pt-6">
              <Link
                href="/recruitment-core-hub-dashboard/recruitment/interviews"
                className="w-full sm:w-auto text-center rounded-xl border border-gray-200 px-5 py-2.5 text-xs font-bold text-gray-600 transition hover:bg-gray-50"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#CB1A8E] px-6 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#a31270] active:scale-[0.99] disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <svg className="h-3.5 w-3.5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Saving...</span>
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}