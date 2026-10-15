"use client";

import { useCallback, useEffect, useState } from "react";

type RequestRow = { id: string; position_title: string; number_of_positions: number; status: string; created_at: string; review_remarks: string | null };
const inputClass = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500";
const initialForm = { position_title: "", number_of_positions: "1", job_description: "", requirements: "", reason_for_request: "", salary_range: "", employment_type: "", work_arrangement: "", work_location: "", hiring_deadline: "", benefits: "" };

export default function DepartmentManpowerRequestPage() {
  const [form, setForm] = useState(initialForm);
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [department, setDepartment] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/hr1/manpower-requests", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || data.role !== "department") throw new Error(data.error || "An authenticated employee account with an assigned department is required.");
      setRows(data.requests ?? []); setDepartment(data.department ?? ""); setAuthorized(true);
    } catch (err) { setAuthorized(false); setError(err instanceof Error ? err.message : "Unable to load requests"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    // Load the signed-in manager's records after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  function setField(name: keyof typeof initialForm, value: string) { setForm((current) => ({ ...current, [name]: value })); }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/hr1/manpower-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, number_of_positions: Number(form.number_of_positions) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Request was not submitted");
      setForm(initialForm); setMessage("Request submitted for HR review."); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Request was not submitted"); }
    finally { setSaving(false); }
  }

  return <main className="mx-auto max-w-5xl space-y-6 px-5 py-10">
    <header><p className="text-sm font-semibold text-pink-600">Airship Express · Department Request</p><h1 className="mt-1 text-3xl font-bold text-gray-900">Manpower Request</h1><p className="mt-2 text-sm text-gray-600">Active department employees submit staffing needs. HR Admin reviews every request before any vacancy is posted.</p></header>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    {message && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">{message}</div>}
    {loading ? <p className="rounded-xl bg-white p-8 text-center text-gray-500">Checking your account…</p> : authorized && <>
      <section className="rounded-xl border border-gray-200 bg-white p-6"><p className="text-sm text-gray-500">Requesting department</p><p className="mt-1 font-semibold text-gray-900">{department}</p></section>
      <form onSubmit={submit} className="grid gap-5 rounded-xl border border-gray-200 bg-white p-6 md:grid-cols-2">
        <h2 className="text-lg font-bold md:col-span-2">Hiring Need and Approved Requirements</h2>
        <label className="space-y-2 text-sm font-medium">Position title *<input required maxLength={150} className={inputClass} value={form.position_title} onChange={(e) => setField("position_title", e.target.value)} /></label>
        <label className="space-y-2 text-sm font-medium">Number needed *<input required type="number" min={1} max={10000} className={inputClass} value={form.number_of_positions} onChange={(e) => setField("number_of_positions", e.target.value)} /></label>
        <label className="space-y-2 text-sm font-medium">Job description and responsibilities *<textarea required maxLength={5000} rows={4} className={inputClass} value={form.job_description} onChange={(e) => setField("job_description", e.target.value)} /></label>
        <label className="space-y-2 text-sm font-medium">Qualifications and requirements *<textarea required maxLength={5000} rows={4} className={inputClass} value={form.requirements} onChange={(e) => setField("requirements", e.target.value)} /></label>
        <label className="space-y-2 text-sm font-medium md:col-span-2">Reason / staffing justification *<textarea required maxLength={3000} rows={3} className={inputClass} value={form.reason_for_request} onChange={(e) => setField("reason_for_request", e.target.value)} /></label>
        <label className="space-y-2 text-sm font-medium">Proposed salary range<input maxLength={150} className={inputClass} value={form.salary_range} onChange={(e) => setField("salary_range", e.target.value)} /></label>
        <label className="space-y-2 text-sm font-medium">Employment type<input maxLength={100} className={inputClass} value={form.employment_type} onChange={(e) => setField("employment_type", e.target.value)} placeholder="If applicable" /></label>
        <label className="space-y-2 text-sm font-medium">Work arrangement<input maxLength={100} className={inputClass} value={form.work_arrangement} onChange={(e) => setField("work_arrangement", e.target.value)} placeholder="If applicable" /></label>
        <label className="space-y-2 text-sm font-medium">Work location<input maxLength={250} className={inputClass} value={form.work_location} onChange={(e) => setField("work_location", e.target.value)} /></label>
        <label className="space-y-2 text-sm font-medium">Preferred hiring deadline<input type="date" min={new Date().toLocaleDateString("en-CA")} className={inputClass} value={form.hiring_deadline} onChange={(e) => setField("hiring_deadline", e.target.value)} /></label>
        <label className="space-y-2 text-sm font-medium">Benefits / additional information<textarea maxLength={3000} rows={3} className={inputClass} value={form.benefits} onChange={(e) => setField("benefits", e.target.value)} /></label>
        <div className="flex justify-end md:col-span-2"><button disabled={saving} className="rounded-lg bg-pink-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Submitting…" : "Submit for HR Review"}</button></div>
      </form>
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white"><div className="border-b p-5"><h2 className="font-bold">Department Requests</h2><p className="mt-1 text-sm text-gray-500">Requests for {department}</p></div>{rows.length === 0 ? <p className="p-8 text-center text-sm text-gray-500">No requests yet.</p> : <div className="divide-y">{rows.map((row) => <article key={row.id} className="flex flex-wrap items-start justify-between gap-3 p-5"><div><h3 className="font-semibold">{row.position_title} · {row.number_of_positions} position(s)</h3><p className="mt-1 text-xs text-gray-500">Submitted {new Date(row.created_at).toLocaleDateString()}</p>{row.review_remarks && <p className="mt-2 text-sm text-gray-600">HR remarks: {row.review_remarks}</p>}</div><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">{row.status}</span></article>)}</div>}</section>
    </>}
  </main>;
}
