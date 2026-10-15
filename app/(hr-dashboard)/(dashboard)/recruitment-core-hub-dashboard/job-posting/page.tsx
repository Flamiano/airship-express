"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Job = {
  id: string; title: string; department: string; description: string;
  requirements: string; is_active: boolean; posting_status?: string;
  manpower_request_id?: string | null; created_at: string;
};
type ApprovedRequest = {
  id: string; department: string; position_title: string; number_of_positions: number;
  positions_posted: number; review_remarks: string | null;
};

export default function JobPostingsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [requests, setRequests] = useState<ApprovedRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/hr1/job-postings", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load job postings");
      setJobs(data.jobs ?? []); setRequests(data.approvedRequests ?? []);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load job postings"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    // Load request data after mount; updates occur after the asynchronous fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function createDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/hr1/job-postings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manpower_request_id: selectedRequest }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create draft");
      setMessage("Draft created from the approved request. Review it before publishing.");
      setSelectedRequest(""); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to create draft"); }
    finally { setSaving(false); }
  }

  async function setStatus(job: Job) {
    const next = job.is_active ? "Closed" : "Published";
    if (!window.confirm(`${next === "Published" ? "Publish" : "Close"} ${job.title}?`)) return;
    setError(""); setMessage("");
    try {
      const response = await fetch("/api/hr1/job-postings", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: job.id, posting_status: next }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update posting");
      setMessage(next === "Published" ? "Vacancy published on the Careers Portal." : "Vacancy closed.");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to update posting"); }
  }

  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
      <p className="text-sm font-medium text-[#e5167e]">Recruitment Management</p>
      <h1 className="mt-1 text-2xl font-bold text-gray-900">Job Postings</h1>
      <p className="mt-2 text-sm text-gray-500">Create vacancies only from HR-approved department manpower requests.</p>
      </div>
      <Link href="/careers" target="_blank" className="inline-flex w-fit rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:border-[#e5167e] hover:text-[#e5167e]">Preview Careers Portal</Link>
    </header>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    {message && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">{message}</div>}

    <form onSubmit={createDraft} className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label htmlFor="approved-request" className="mb-2 block text-sm font-medium text-gray-700">Approved manpower request</label>
        <select id="approved-request" required value={selectedRequest} onChange={(e) => setSelectedRequest(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm">
          <option value="">Choose a request with remaining approved headcount</option>
          {requests.filter((r) => r.positions_posted < r.number_of_positions).map((r) => <option key={r.id} value={r.id}>{r.position_title} — {r.department} ({r.number_of_positions - r.positions_posted} remaining)</option>)}
        </select>
      </div>
      <button disabled={saving || !selectedRequest} className="rounded-lg bg-[#e5167e] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Creating…" : "Create Draft from Request"}</button>
    </form>

    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 p-5"><h2 className="font-bold text-gray-900">Position List</h2><p className="mt-1 text-sm text-gray-500">Legacy positions remain unpublished until they have an approved request link.</p></div>
      {loading ? <p className="p-8 text-center text-sm text-gray-500">Loading job postings…</p> : jobs.length === 0 ? <p className="p-10 text-center text-sm text-gray-500">No job postings found.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-5 py-4">Position</th><th className="px-5 py-4">Department</th><th className="px-5 py-4">Source</th><th className="px-5 py-4">Status</th><th className="px-5 py-4 text-right">Action</th></tr></thead>
        <tbody className="divide-y divide-gray-100">{jobs.map((job) => <tr key={job.id} className="align-top hover:bg-gray-50"><td className="px-5 py-4"><p className="font-semibold">{job.title}</p><p className="mt-1 max-w-lg text-xs text-gray-500">{job.description}</p></td><td className="px-5 py-4">{job.department}</td><td className="px-5 py-4">{job.manpower_request_id ? "Approved request" : "Legacy / no request"}</td><td className="px-5 py-4">{job.posting_status ?? (job.is_active ? "Legacy active" : "Legacy inactive")}</td><td className="px-5 py-4 text-right">{job.manpower_request_id && <button type="button" onClick={() => void setStatus(job)} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold hover:border-[#e5167e]">{job.is_active ? "Close" : "Publish"}</button>}</td></tr>)}</tbody>
      </table></div>}
    </section>
  </div>;
}
