"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/(hr-dashboard)/supabase/client";

type JobPosition = {
  id: string;
  title: string;
  department: string;
};

export default function NewApplicantPage() {
  const router = useRouter();
  const supabase = createClient();

  const [positions, setPositions] = useState<JobPosition[]>([]);
  const [loadingPositions, setLoadingPositions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<{ existingId: string; message: string } | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [jobPositionId, setJobPositionId] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [resumeText, setResumeText] = useState("");

  useEffect(() => {
    async function loadPositions() {
      setLoadingPositions(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from("hr1_job_positions")
          .select("id, title, department")
          .eq("is_active", true)
          .order("title", { ascending: true });

        if (fetchError) throw fetchError;
        setPositions((data as JobPosition[]) || []);
      } catch (err: any) {
        console.error("JOB POSITION LOAD ERROR:", err);
        setError(`Unable to load open positions: ${err?.message || "Unexpected error"}`);
      } finally {
        setLoadingPositions(false);
      }
    }

    loadPositions();
  }, [supabase]);

  async function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingResume(true);
    setError(null);

    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `resumes/new-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("resumes")
        .getPublicUrl(filePath);

      setResumeUrl(publicUrlData.publicUrl);
    } catch (err: any) {
      console.error("RESUME UPLOAD ERROR:", err);
      setError(`File upload failed: ${err.message || "Ensure 'resumes' storage bucket exists"}`);
    } finally {
      setUploadingResume(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setDuplicateWarning(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("You must be logged in to encode an applicant.");
      }

      // ==========================================
      // DUPLICATE CANDIDATE CHECK
      // ==========================================
      const cleanEmail = email.trim().toLowerCase();
      const cleanPhone = phone.trim();

      const { data: existingApplicants, error: checkError } = await supabase
        .from("hr1_applicants")
        .select("id, first_name, last_name, email, phone")
        .or(`email.eq.${cleanEmail},phone.eq.${cleanPhone}`);

      if (checkError) {
        console.error("Duplicate check error:", checkError);
      } else if (existingApplicants && existingApplicants.length > 0) {
        const match = existingApplicants[0];
        setDuplicateWarning({
          existingId: match.id,
          message: `A candidate (${match.first_name} ${match.last_name}) with this email or phone number already exists in the system.`,
        });
        setSaving(false);
        return;
      }

      // ==========================================
      // INSERT APPLICANT
      // ==========================================
      const { data: insertedApplicant, error: insertError } = await supabase
        .from("hr1_applicants")
        .insert({
          job_position_id: jobPositionId,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: cleanEmail,
          phone: cleanPhone,
          address: address.trim() || null,
          resume_url: resumeUrl.trim() || null,
          resume_text: resumeText.trim() || null,
          encoded_by: user.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // ==========================================
      // LOG ACTIVITY
      // ==========================================
      if (insertedApplicant) {
        await supabase.from("hr1_applicant_activity_logs").insert({
          applicant_id: insertedApplicant.id,
          user_id: user.id,
          action_type: "CREATED",
          description: `Candidate profile created by HR.`,
        });
      }

      router.push("/recruitment-core-hub-dashboard/applicants");
      router.refresh();
    } catch (err: any) {
      console.error("APPLICANT INSERT ERROR:", err);
      setError(`Save failed: ${err?.message || "Check network connection or permissions"}`);
      setSaving(false);
    }
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
            <span className="text-gray-900">New Applicant</span>
          </div>
          <span className="self-start sm:self-auto text-xs font-bold text-[#CB1A8E] bg-[#CB1A8E]/10 px-3 py-1 rounded-full uppercase tracking-wider">
            HR Recruitment
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 pt-6 sm:pt-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#121212]">
              Add New Applicant
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-gray-500">
              Encode a new candidate profile into the HR recruitment records.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-start justify-between rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700 shadow-xs">
            <div className="flex items-center gap-3">
              <svg className="h-5 w-5 shrink-0 text-red-500 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 font-bold p-1">✕</button>
          </div>
        )}

        {/* Duplicate Warning Banner */}
        {duplicateWarning && (
          <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800 shadow-xs">
            <div className="flex items-center gap-2 font-bold">
              <span>⚠️ Duplicate Candidate Detected</span>
            </div>
            <p>{duplicateWarning.message}</p>
            <div>
              <Link
                href={`/recruitment-core-hub-dashboard/applicants/${duplicateWarning.existingId}/edit`}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-700 transition"
              >
                View / Edit Existing Profile →
              </Link>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8 rounded-2xl border border-gray-100 bg-white p-5 sm:p-8 shadow-sm">
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
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
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
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[#CB1A8E] focus:ring-2 focus:ring-[#CB1A8E]/15"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[#CB1A8E] focus:ring-2 focus:ring-[#CB1A8E]/15"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
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
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
                placeholder="Enter street name, city, or region"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[#CB1A8E] focus:ring-2 focus:ring-[#CB1A8E]/15 resize-y placeholder:text-gray-400"
              />
            </div>
          </div>

          <div>
            <div className="mb-4 pb-2 border-b border-gray-100">
              <h2 className="text-sm sm:text-base font-bold text-[#121212]">
                Role Association
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">Target opening for this applicant</p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-700">
                Applied Position <span className="text-red-500">*</span>
              </label>
              <select
                value={jobPositionId}
                onChange={(e) => setJobPositionId(e.target.value)}
                required
                disabled={loadingPositions}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[#CB1A8E] focus:ring-2 focus:ring-[#CB1A8E]/15 disabled:opacity-50"
              >
                <option value="">{loadingPositions ? "Loading open positions..." : "Select a position"}</option>
                {positions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.title} — {position.department}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="mb-4 pb-2 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <h2 className="text-sm sm:text-base font-bold text-[#121212]">
                Resume & Evaluation Data
              </h2>
              <p className="text-xs text-gray-500">Document storage and parsing records</p>
            </div>
            
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
                  value={resumeUrl}
                  onChange={(e) => setResumeUrl(e.target.value)}
                  placeholder="https://storage.example.com/file.pdf"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[#CB1A8E] focus:ring-2 focus:ring-[#CB1A8E]/15 placeholder:text-gray-400"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-700">
                Raw Resume Text Content
              </label>
              <p className="mb-2 text-xs text-gray-400">
                Extracted plain text will be parsed by automated recruitment screening and AI scoring filters.
              </p>
              <textarea
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                rows={6}
                placeholder="Paste or extract full plain text resume body here..."
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-mono text-gray-800 outline-none transition focus:border-[#CB1A8E] focus:ring-2 focus:ring-[#CB1A8E]/15 resize-y placeholder:text-gray-400"
              />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 border-t border-gray-100 pt-6">
            <Link
              href="/recruitment-core-hub-dashboard/applicants"
              className="rounded-xl border border-gray-200 px-5 py-3 text-xs font-bold text-gray-600 hover:bg-gray-50 text-center transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving || loadingPositions || uploadingResume}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#CB1A8E] px-6 py-3 text-xs font-bold text-white shadow-sm hover:bg-[#a31270] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 transition"
            >
              {saving ? (
                <>
                  <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Saving Candidate...</span>
                </>
              ) : (
                "Save Applicant"
              )}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}