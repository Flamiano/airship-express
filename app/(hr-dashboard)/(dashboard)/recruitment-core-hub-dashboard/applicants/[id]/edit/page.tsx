"use client";

import { useEffect, useState, ChangeEvent, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/app/(hr-dashboard)/supabase/client";

type JobPosition = {
  id: string;
  title: string;
};

type ApplicantForm = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  resume_url: string;
  resume_text: string;
  job_position_id: string;
};

export default function EditApplicantPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  // Extract and sanitize ID from route params
  const rawId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const applicantId = rawId ? decodeURIComponent(rawId) : "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobPositions, setJobPositions] = useState<JobPosition[]>([]);

  const [form, setForm] = useState<ApplicantForm>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    address: "",
    resume_url: "",
    resume_text: "",
    job_position_id: "",
  });

  // ==========================================
  // INITIAL DATA FETCH WITH VALIDATION FIX
  // ==========================================

  useEffect(() => {
    if (
      applicantId &&
      applicantId !== "[id]" &&
      applicantId !== "%5Bid%5D"
    ) {
      loadInitialData(applicantId);
    }
  }, [applicantId]);

  async function loadInitialData(targetId: string) {
    setLoading(true);
    setError(null);

    try {
      // Execute applicant fetch and positions query concurrently using hr1_ tables
      const [applicantRes, positionsRes] = await Promise.all([
        supabase
          .from("hr1_applicants")
          .select(
            `
            id,
            first_name,
            last_name,
            email,
            phone,
            address,
            resume_url,
            resume_text,
            job_position_id
          `
          )
          .eq("id", targetId)
          .single(),
        supabase
          .from("hr1_job_positions")
          .select("id, title")
          .order("title", { ascending: true }),
      ]);

      if (applicantRes.error) {
        throw new Error(`Failed to load candidate: ${applicantRes.error.message}`);
      }

      if (positionsRes.error) {
        console.error("Job positions fetch error:", positionsRes.error);
      } else {
        setJobPositions(positionsRes.data || []);
      }

      const app = applicantRes.data;
      setForm({
        first_name: app.first_name || "",
        last_name: app.last_name || "",
        email: app.email || "",
        phone: app.phone || "",
        address: app.address || "",
        resume_url: app.resume_url || "",
        resume_text: app.resume_text || "",
        job_position_id: app.job_position_id || "",
      });
    } catch (err: any) {
      console.error("EDIT APPLICANT LOAD ERROR:", err);
      setError(err?.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // FORM FIELD HANDLER
  // ==========================================

  function handleChange(
    e: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  // ==========================================
  // RESUME FILE UPLOAD TO SUPABASE STORAGE
  // ==========================================

  async function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !applicantId) return;

    setUploadingResume(true);
    setError(null);

    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `resumes/${applicantId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("resumes")
        .getPublicUrl(filePath);

      setForm((prev) => ({
        ...prev,
        resume_url: publicUrlData.publicUrl,
      }));
    } catch (err: any) {
      console.error("RESUME UPLOAD ERROR:", err);
      setError(`File upload failed: ${err.message || "Ensure storage bucket exists"}`);
    } finally {
      setUploadingResume(false);
    }
  }

  // ==========================================
  // SUBMIT HANDLER
  // ==========================================

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!applicantId) return;

    setSaving(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error: updateError } = await supabase
        .from("hr1_applicants")
        .update({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          address: form.address.trim() || null,
          resume_url: form.resume_url.trim() || null,
          resume_text: form.resume_text.trim() || null,
          job_position_id: form.job_position_id || null,
        })
        .eq("id", applicantId);

      if (updateError) throw updateError;

      // Log update action
      await supabase.from("hr1_applicant_activity_logs").insert({
        applicant_id: applicantId,
        user_id: user?.id || null,
        action_type: "UPDATED",
        description: `Candidate profile updated by HR.`,
      });

      router.push("/recruitment-core-hub-dashboard/applicants");
      router.refresh();
    } catch (err: any) {
      console.error("APPLICANT UPDATE ERROR:", err);
      setError(`Save failed: ${err?.message || "Check network connection or permissions"}`);
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8F9FA] px-4">
        <div className="flex w-full max-w-sm items-center gap-3.5 rounded-2xl bg-white px-6 py-5 shadow-sm border border-gray-100">
          <svg className="h-5 w-5 animate-spin text-[#CB1A8E] shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-gray-900">Loading applicant details</span>
            <span className="text-xs text-gray-500">Please wait a moment...</span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F9FA] pb-16">
      {/* Sub-header / Breadcrumbs */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10 shadow-xs">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
            <Link href="/recruitment-core-hub-dashboard/applicants" className="hover:text-[#CB1A8E] transition">
              Applicants
            </Link>
            <span>/</span>
            <span className="text-gray-900">Edit Profile</span>
          </div>

          <span className="self-start sm:self-auto text-xs font-bold text-[#CB1A8E] bg-[#CB1A8E]/10 px-3 py-1 rounded-full uppercase tracking-wider">
            ID: {applicantId.slice(0, 8)}
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="mx-auto max-w-4xl px-4 sm:px-6 pt-6 sm:pt-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#121212]">
              Edit Applicant Profile
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-gray-500">
              Update candidate contact information, job association, and resume records.
            </p>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mb-6 flex items-start justify-between rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700 shadow-xs">
            <div className="flex items-center gap-3">
              <svg className="h-5 w-5 shrink-0 text-red-500 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 font-bold p-1">
              ✕
            </button>
          </div>
        )}

        {/* Edit Form */}
        <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8 rounded-2xl border border-gray-100 bg-white p-5 sm:p-8 shadow-sm">
          {/* Section: Basic Contact Info */}
          <div>
            <div className="mb-4 pb-2 border-b border-gray-100">
              <h2 className="text-sm sm:text-base font-bold text-[#121212]">
                Personal Information
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">Essential identification and contact details</p>
            </div>

            <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-700">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="first_name"
                  value={form.first_name}
                  onChange={handleChange}
                  required
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[#CB1A8E] focus:ring-2 focus:ring-[#CB1A8E]/15"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="last_name"
                  value={form.last_name}
                  onChange={handleChange}
                  required
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[#CB1A8E] focus:ring-2 focus:ring-[#CB1A8E]/15"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Email Address <span className="text-[#CB1A8E]">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[#CB1A8E] focus:ring-2 focus:ring-[#CB1A8E]/15"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Phone Number <span className="text-[#CB1A8E]">*</span>
                </label>
                <input
                  type="text"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  required
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[#CB1A8E] focus:ring-2 focus:ring-[#CB1A8E]/15"
                />
              </div>
            </div>

            <div className="mt-4 sm:mt-5">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-700">
                Residential Address
              </label>
              <textarea
                name="address"
                value={form.address}
                onChange={handleChange}
                rows={2}
                placeholder="Enter street name, city, or region"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[#CB1A8E] focus:ring-2 focus:ring-[#CB1A8E]/15 placeholder:text-gray-400 resize-y"
              />
            </div>
          </div>

          {/* Section: Application Position */}
          <div>
            <div className="mb-4 pb-2 border-b border-gray-100">
              <h2 className="text-sm sm:text-base font-bold text-[#121212]">
                Role Association
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">Target opening for this applicant</p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-700">
                Applied Position <span className="text-[#CB1A8E]">*</span>
              </label>
              <select
                name="job_position_id"
                value={form.job_position_id}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[#CB1A8E] focus:ring-2 focus:ring-[#CB1A8E]/15 bg-white"
              >
                <option value="">Select an open job position</option>
                {jobPositions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section: Resume & AI Context */}
          <div>
            <div className="mb-4 pb-2 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <h2 className="text-sm sm:text-base font-bold text-[#121212]">
                Resume & AI Evaluation Data
              </h2>
              <p className="text-xs text-gray-500">Document storage and parsing records</p>
            </div>

            {/* File Upload / Link */}
            <div className="grid gap-4 sm:gap-5 md:grid-cols-2 mb-5">
              <div className="rounded-xl border border-dashed border-gray-200 p-4 bg-gray-50/50 flex flex-col justify-between">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Upload Resume File
                  </label>
                  <p className="text-xs text-gray-400 mb-3">Accepts PDF, DOC, DOCX formats</p>
                </div>
                <div>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileUpload}
                    disabled={uploadingResume}
                    className="w-full text-xs text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#CB1A8E]/10 file:text-[#CB1A8E] hover:file:bg-[#CB1A8E]/20 cursor-pointer disabled:opacity-50"
                  />
                  {uploadingResume && (
                    <div className="mt-2.5 flex items-center gap-2 text-xs text-amber-600 font-medium">
                      <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Uploading document to storage...</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Resume URL Direct Link
                </label>
                <p className="text-xs text-gray-400 mb-3">External hosting link if applicable</p>
                <input
                  type="url"
                  name="resume_url"
                  value={form.resume_url}
                  onChange={handleChange}
                  placeholder="https://storage.example.com/file.pdf"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[#CB1A8E] focus:ring-2 focus:ring-[#CB1A8E]/15 placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* Extracted Resume Text */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-700">
                Raw Resume Text Content
              </label>
              <p className="mb-2 text-xs text-gray-400">
                Extracted plain text will be parsed by automated recruitment screening and AI scoring filters.
              </p>
              <textarea
                name="resume_text"
                value={form.resume_text}
                onChange={handleChange}
                rows={8}
                placeholder="Paste or extract full plain text resume body here..."
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-mono text-gray-800 outline-none transition focus:border-[#CB1A8E] focus:ring-2 focus:ring-[#CB1A8E]/15 placeholder:text-gray-400 resize-y"
              />
            </div>
          </div>

          {/* Submit & Cancel Buttons */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 border-t border-gray-100 pt-6">
            <button
              type="button"
              onClick={() => router.push("/recruitment-core-hub-dashboard/applicants")}
              disabled={saving}
              className="rounded-xl border border-gray-200 px-5 py-3 text-xs font-bold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50 text-center"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving || uploadingResume}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#CB1A8E] px-6 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-[#a31270] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <>
                  <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Updating Profile...</span>
                </>
              ) : (
                "Save Profile Changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}