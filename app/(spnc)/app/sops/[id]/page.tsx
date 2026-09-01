"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import DocumentLogo from "@/components/DocumentLogo";

type SOP = {
  id: string;
  title: string;
  sop_code: string;
  category: string;
  scope?: string | null;
  version: string;
  effective_date?: string | null;
  review_date?: string | null;
  content?: string | null;
  owner?: string | null;
  status: string;
};

export default function SOPDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [sop, setSop] = useState<SOP | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSop() {
      setLoading(true);
      try {
        const res = await fetch(`/api/sops/${params.id}`);
        const data = await res.json();
        setSop(data.sop || null);
      } catch (err) {
        console.error("Fetch SOP failed:", err);
      } finally {
        setLoading(false);
      }
    }
    if (params.id) fetchSop();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white">
        <Loader2 size={32} className="animate-spin text-[#F2419B]" />
        <p className="text-sm font-semibold text-[#F2419B]">Loading</p>
      </div>
    );
  }

  if (!sop) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white">
        <p className="text-sm text-gray-500">SOP not found.</p>
        <button onClick={() => router.push("/sops")} className="text-sm text-[#F2419B] hover:underline">
          Back to SOPs
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-8 py-10">
      <div className="print-hidden mb-8 flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push("/sops")}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft size={16} />
          Back to SOPs
        </button>
        <button type="button" onClick={() => window.print()} className="flex items-center gap-2 rounded-md bg-[#F2419B] px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-[#D9297E]">
          <Printer size={18} />
          Print
        </button>
      </div>

      <div className="mx-auto max-w-3xl">
        <DocumentLogo />
        <h1 className="mt-2 text-3xl font-bold text-gray-900">{sop.title}</h1>
        <p className="mt-2 text-sm text-gray-500">
          Standard Operating Procedure · {sop.sop_code} · Version {sop.version}
        </p>

        <div className="mt-4 h-1 w-full bg-[#F2419B]" />

        <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-6 border border-gray-200 p-6">
          <div>
            <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">SOP Code</p>
            <p className="mt-1 text-sm text-gray-900">{sop.sop_code}</p>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Version</p>
            <p className="mt-1 text-sm text-gray-900">{sop.version}</p>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Category</p>
            <p className="mt-1 text-sm text-gray-900">{sop.category}</p>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Owner / Department</p>
            <p className="mt-1 text-sm text-gray-900">{sop.owner || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Effective Date</p>
            <p className="mt-1 text-sm text-gray-900">{sop.effective_date || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Review Date</p>
            <p className="mt-1 text-sm text-gray-900">{sop.review_date || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Status</p>
            <p className="mt-1 text-sm text-gray-900">{sop.status}</p>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Scope</p>
            <p className="mt-1 text-sm text-gray-900">{sop.scope || "—"}</p>
          </div>
        </div>

        <div className="mt-8">
          <p className="border-b border-gray-200 pb-2 text-sm font-bold tracking-wide text-gray-900 uppercase">
            Procedure
          </p>
          <p className="mt-4 text-sm leading-relaxed text-gray-800">{sop.content || "No procedure content added."}</p>
        </div>

        <div className="mt-16 flex items-center justify-between border-t border-gray-200 pt-3 text-xs text-gray-400">
          <span>
            {sop.sop_code} · Version {sop.version}
          </span>
          <span>Airship Express</span>
        </div>
      </div>
    </div>
  );
}
