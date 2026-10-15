"use client";

import { useCallback, useEffect, useState } from "react";

type RequestRow = {
  id: string; department: string; position_title: string; number_of_positions: number;
  job_description: string; requirements: string; reason_for_request: string;
  salary_range: string | null; employment_type: string | null;
  work_arrangement: string | null; work_location: string | null;
  benefits: string | null; hiring_deadline: string | null; requested_by: string | null;
  status: string; review_remarks: string | null; reviewed_at: string | null; created_at: string;
};
const inputClass = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500";

export default function ManpowerRequestsPage() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/hr1/manpower-requests", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load requests");
      if (data.role !== "hr") throw new Error("HR reviewer access required.");
      setRequests(data.requests ?? []);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load requests"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    // Load request data after mount; updates occur after the asynchronous fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function review(row: RequestRow, decision: "Approved" | "Rejected" | "Revision Requested") {
    const reviewRemarks = remarks[row.id]?.trim() ?? "";
    if (!reviewRemarks) { setError("Add review remarks before recording a decision."); return; }
    if (!window.confirm(`${decision} the request for ${row.position_title}?`)) return;
    setBusyId(row.id); setError(""); setMessage("");
    try {
      const response = await fetch("/api/hr1/manpower-requests", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, status: decision, review_remarks: reviewRemarks }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to record HR decision");
      setMessage(`${decision} decision saved.`); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to record decision"); }
    finally { setBusyId(""); }
  }

  const visible = requests.filter((row) => {
    const term = search.toLowerCase();
    const match = [row.department, row.position_title, row.reason_for_request].some((value) => value?.toLowerCase().includes(term));
    return match && (status === "All" || row.status === status);
  });
  return <div className="mx-auto max-w-7xl space-y-6">
    <header><p className="text-sm font-medium text-pink-600">Recruitment Management</p><h1 className="mt-1 text-2xl font-bold text-gray-900">Manpower Requests</h1><p className="mt-2 text-sm text-gray-500">Review department-submitted staffing needs and record the decision before creating vacancies.</p></header>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    {message && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">{message}</div>}
    <div className="grid gap-4 sm:grid-cols-3">{[{ label: "Total Requests", count: requests.length }, { label: "Pending Review", count: requests.filter((r) => r.status === "Pending").length }, { label: "Approved", count: requests.filter((r) => r.status === "Approved").length }].map((item) => <div key={item.label} className="rounded-xl border bg-white p-5"><p className="text-sm text-gray-500">{item.label}</p><p className="mt-2 text-3xl font-bold">{item.count}</p></div>)}</div>
    <section className="overflow-hidden rounded-xl border bg-white"><div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold">Submitted Requests</h2><p className="mt-1 text-sm text-gray-500">Approval is required before creating a job posting.</p></div><div className="flex flex-col gap-2 sm:flex-row"><input className={inputClass} type="search" aria-label="Search requests" placeholder="Search position, department" value={search} onChange={(e) => setSearch(e.target.value)} /><select className={inputClass} aria-label="Filter requests" value={status} onChange={(e) => setStatus(e.target.value)}>{["All", "Pending", "Approved", "Rejected", "Revision Requested"].map((item) => <option key={item}>{item}</option>)}</select><button type="button" onClick={() => void load()} className="rounded-lg border px-4 py-2 text-sm">Refresh</button></div></div>
      {loading ? <p className="p-8 text-center text-sm text-gray-500">Loading requests…</p> : visible.length === 0 ? <p className="p-10 text-center text-sm text-gray-500">No requests found.</p> : <div className="divide-y">{visible.map((row) => <article key={row.id} className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">{row.position_title}</h3><p className="text-sm text-gray-500">{row.department} · {row.number_of_positions} needed · Submitted {new Date(row.created_at).toLocaleDateString()}</p></div><span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold">{row.status}</span></div>
        <div className="grid gap-4 text-sm md:grid-cols-2"><div><p className="font-semibold">Staffing reason</p><p className="mt-1 whitespace-pre-wrap text-gray-600">{row.reason_for_request}</p></div><div><p className="font-semibold">Job description</p><p className="mt-1 whitespace-pre-wrap text-gray-600">{row.job_description}</p></div><div><p className="font-semibold">Qualifications</p><p className="mt-1 whitespace-pre-wrap text-gray-600">{row.requirements}</p></div><div><p className="font-semibold">Additional details</p><p className="mt-1 text-gray-600">Salary: {row.salary_range || "Not provided"} · Employment: {row.employment_type || "Not provided"} · Arrangement: {row.work_arrangement || "Not provided"} · Location: {row.work_location || "Not provided"} · Deadline: {row.hiring_deadline || "Not provided"}</p><p className="mt-1 text-gray-600">Benefits: {row.benefits || "Not provided"}</p></div></div>
        {row.review_remarks && <p className="text-sm text-gray-600">Previous HR remarks: {row.review_remarks}</p>}
        {(row.status === "Pending" || row.status === "Revision Requested") && <div className="space-y-3 border-t pt-4"><label className="block text-sm font-medium">Review remarks<textarea rows={2} maxLength={3000} className={`${inputClass} mt-1`} value={remarks[row.id] ?? ""} onChange={(e) => setRemarks((current) => ({ ...current, [row.id]: e.target.value }))} placeholder="Explain approval, rejection, or requested revisions." /></label><div className="flex flex-wrap gap-2"><button disabled={busyId === row.id} onClick={() => void review(row, "Approved")} className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Approve</button><button disabled={busyId === row.id} onClick={() => void review(row, "Revision Requested")} className="rounded-lg border border-amber-400 px-4 py-2 text-sm font-semibold text-amber-800 disabled:opacity-50">Request Revision</button><button disabled={busyId === row.id} onClick={() => void review(row, "Rejected")} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Reject</button></div></div>}
      </article>)}</div>}
    </section>
  </div>;
}
