"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

type RequestedDocument = {
  type: string;
  label: string;
  latest: null | {
    submission_status: string;
    verification_status: string;
    verification_remarks: string | null;
    created_at: string;
  };
};

type OnboardingInfo = {
  applicant_name: string;
  surname: string;
  given_name: string;
  email: string;
  expires_at: string;
  documents: RequestedDocument[];
  background_information: BackgroundInformation | null;
};

type BackgroundInformation = {
  surname: string;
  given_name: string;
  middle_name: string;
  name_suffix: string;
  civil_status: string;
  gender: string;
  birth_date: string;
  contact_number: string;
  sss_number: string;
  philhealth_number: string;
  pagibig_number: string;
  tin_number: string;
  current_address: string;
  permanent_address: string;
};

const EMPTY_BACKGROUND_INFORMATION: BackgroundInformation = {
  surname: "", given_name: "", middle_name: "", name_suffix: "",
  civil_status: "", gender: "", birth_date: "", contact_number: "", sss_number: "",
  philhealth_number: "", pagibig_number: "", tin_number: "", current_address: "", permanent_address: "",
};

export default function ApplicantOnboardingUploadPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<OnboardingInfo | null>(null);
  const [files, setFiles] = useState<Record<string, File>>({});
  const [backgroundInformation, setBackgroundInformation] = useState<BackgroundInformation>(EMPTY_BACKGROUND_INFORMATION);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/hr1/onboarding-link/${encodeURIComponent(token)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "This link is unavailable.");
      setInfo(result);
      setBackgroundInformation({ ...EMPTY_BACKGROUND_INFORMATION, surname: result.surname ?? "", given_name: result.given_name ?? "", ...(result.background_information ?? {}) });
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This link is unavailable.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // Initial data comes from a network request; state updates happen after it resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function chooseFile(category: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Each document must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
      setError("Upload a PDF, JPG, or PNG document.");
      event.target.value = "";
      return;
    }
    setFiles((current) => ({ ...current, [category]: file }));
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!Object.keys(files).length) {
      setError("Choose at least one requested document to upload.");
      return;
    }
    if (Object.values(backgroundInformation).some((value) => !value.trim())) {
      setError("Complete every background investigation field. Enter N/A where a number does not apply.");
      return;
    }
    setSaving(true);
    try {
      const body = new FormData();
      for (const [category, file] of Object.entries(files)) body.set(category, file, file.name);
      body.set("background_information", JSON.stringify(backgroundInformation));
      const response = await fetch(`/api/hr1/onboarding-link/${encodeURIComponent(token)}`, { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Upload failed. Please try again.");
      setFiles({});
      setSuccess(result.message || "Documents submitted.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-pink-600">Airship Express · Human Resources</p>
          <h1 className="mt-2 text-2xl font-bold">Onboarding Form & Documents</h1>
          {info && <p className="mt-2 text-sm text-slate-600">Hello {info.applicant_name}. Complete your background investigation details and upload the documents HR requested. This private link expires {new Date(info.expires_at).toLocaleString()}.</p>}
          <p className="mt-3 text-xs text-slate-500">Files are limited to PDF, JPG, or PNG and 5 MB each. Only HR can view or download submitted files. Enter N/A for a government number that does not apply.</p>
        </header>

        {loading ? <div className="rounded-2xl border bg-white p-8 text-sm text-slate-500">Loading your secure checklist…</div> : error && !info ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</div> : info ? (
          <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap justify-between gap-2 border-b border-slate-100 pb-4 text-sm">
              <span className="font-semibold">{info.applicant_name}</span><span className="text-slate-500">{info.email}</span>
            </div>
            <section className="space-y-4 rounded-xl border border-slate-200 p-4 sm:p-5">
              <div>
                <h2 className="text-base font-bold">Background Investigation Form</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">Complete the background investigation form and provide your legal name, contact, government, and address information.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-700">Surname *<input required value={backgroundInformation.surname} onChange={(event) => setBackgroundInformation((current) => ({ ...current, surname: event.target.value }))} className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /></label>
                <label className="block text-xs font-semibold text-slate-700">Given name *<input required value={backgroundInformation.given_name} onChange={(event) => setBackgroundInformation((current) => ({ ...current, given_name: event.target.value }))} className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /></label>
                <label className="block text-xs font-semibold text-slate-700">Complete middle name *<input required value={backgroundInformation.middle_name} onChange={(event) => setBackgroundInformation((current) => ({ ...current, middle_name: event.target.value }))} placeholder="Enter N/A if none" className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /></label>
                <label className="block text-xs font-semibold text-slate-700">Suffix (Jr., Sr., III, etc.) *<input required value={backgroundInformation.name_suffix} onChange={(event) => setBackgroundInformation((current) => ({ ...current, name_suffix: event.target.value }))} placeholder="Enter N/A if none" className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /></label>
                <label className="block text-xs font-semibold text-slate-700 sm:col-span-2">Email address<input value={info.email} readOnly className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-600" /></label>
                <label className="block text-xs font-semibold text-slate-700">Civil status *<select required value={backgroundInformation.civil_status} onChange={(event) => setBackgroundInformation((current) => ({ ...current, civil_status: event.target.value }))} className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">Select civil status</option><option>Single</option><option>Married</option><option>Widowed</option><option>Separated</option><option>Other</option></select></label>
                <label className="block text-xs font-semibold text-slate-700">Gender *<select required value={backgroundInformation.gender} onChange={(event) => setBackgroundInformation((current) => ({ ...current, gender: event.target.value }))} className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">Select gender</option><option>Female</option><option>Male</option><option>Prefer not to say</option><option>Self-describe</option></select></label>
                <label className="block text-xs font-semibold text-slate-700">Birth date *<input type="date" required max={new Date().toISOString().slice(0, 10)} value={backgroundInformation.birth_date} onChange={(event) => setBackgroundInformation((current) => ({ ...current, birth_date: event.target.value }))} className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /></label>
                <label className="block text-xs font-semibold text-slate-700">Contact number *<input required value={backgroundInformation.contact_number} onChange={(event) => setBackgroundInformation((current) => ({ ...current, contact_number: event.target.value }))} className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /></label>
                <label className="block text-xs font-semibold text-slate-700">SSS number *<input required value={backgroundInformation.sss_number} onChange={(event) => setBackgroundInformation((current) => ({ ...current, sss_number: event.target.value }))} placeholder="Enter N/A if not applicable" className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /></label>
                <label className="block text-xs font-semibold text-slate-700">PhilHealth number *<input required value={backgroundInformation.philhealth_number} onChange={(event) => setBackgroundInformation((current) => ({ ...current, philhealth_number: event.target.value }))} placeholder="Enter N/A if not applicable" className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /></label>
                <label className="block text-xs font-semibold text-slate-700">Pag-IBIG number *<input required value={backgroundInformation.pagibig_number} onChange={(event) => setBackgroundInformation((current) => ({ ...current, pagibig_number: event.target.value }))} placeholder="Enter N/A if not applicable" className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /></label>
                <label className="block text-xs font-semibold text-slate-700">Tax identification number *<input required value={backgroundInformation.tin_number} onChange={(event) => setBackgroundInformation((current) => ({ ...current, tin_number: event.target.value }))} placeholder="Enter N/A if not applicable" className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /></label>
                <label className="block text-xs font-semibold text-slate-700 sm:col-span-2">Current address *<textarea required rows={2} value={backgroundInformation.current_address} onChange={(event) => setBackgroundInformation((current) => ({ ...current, current_address: event.target.value }))} className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /></label>
                <label className="block text-xs font-semibold text-slate-700 sm:col-span-2">Permanent address *<textarea required rows={2} value={backgroundInformation.permanent_address} onChange={(event) => setBackgroundInformation((current) => ({ ...current, permanent_address: event.target.value }))} className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /></label>
              </div>
            </section>
            {info.documents.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">HR has not requested any documents through this link. Contact HR if you think this is an error.</p> : info.documents.map((document) => {
              const verified = document.latest?.verification_status === "Verified";
              return <section key={document.type} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">{document.label}</h2>
                  {document.latest && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${verified ? "bg-emerald-50 text-emerald-700" : document.latest.verification_status === "Rejected" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-800"}`}>{document.latest.verification_status}</span>}
                </div>
                {document.latest?.verification_remarks && <p className="mt-2 text-xs text-amber-800">HR note: {document.latest.verification_remarks}</p>}
                {document.latest && <p className="mt-1 text-xs text-slate-500">Last submitted {new Date(document.latest.created_at).toLocaleString()}</p>}
                {verified ? <p className="mt-3 text-xs text-emerald-700">This requirement is verified. Contact HR if it needs to be replaced.</p> : <label className="mt-3 block text-xs text-slate-600">{document.latest ? "Upload a corrected file" : "Choose a file"}<input type="file" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" onChange={(event) => chooseFile(document.type, event)} className="mt-2 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-pink-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-pink-700" />{files[document.type] && <span className="mt-1 block text-xs text-slate-500">Selected: {files[document.type].name}</span>}</label>}
              </section>;
            })}
            {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
            {success && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}
            {info.documents.length > 0 && info.documents.some((document) => document.latest?.verification_status !== "Verified") && <button type="submit" disabled={saving || Object.keys(files).length === 0} className="w-full rounded-xl bg-pink-600 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Uploading securely…" : "Submit selected documents"}</button>}
            <p className="text-center text-xs text-slate-500">Questions? Contact the Airship Express HR team that sent you this link.</p>
          </form>
        ) : null}
      </div>
    </main>
  );
}
