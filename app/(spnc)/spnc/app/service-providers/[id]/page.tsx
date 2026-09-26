"use client";

import { useEffect, useState } from "react";
import { useShell } from "../../../components/ShellContext";
import PageHeader from "../../../components/PageHeader";
import { ArrowLeft, Loader2, Printer, Star } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import DocumentLogo from "../../../components/DocumentLogo";

type ProviderAttachment = {
  name: string;
  dataUrl: string;
};

type ProviderDetail = {
  id: string;
  name: string;
  type: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  country: string | null;
  service_modes: string[];
  status: string;
  rating: number;
  contract_ref: string | null;
  notes: string | null;
  attachments?: ProviderAttachment[];
};

const TYPE_LABELS: Record<string, string> = {
  carrier: "Carrier",
  freight_forwarder: "Freight Forwarder",
  customs_broker: "Customs Broker",
  warehouse: "Warehouse",
  "3pl": "3PL",
};

export default function ServiceProviderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [provider, setProvider] = useState<ProviderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const firstAttachment = provider?.attachments?.[0];

  function handlePrintPdf() {
    if (!firstAttachment?.dataUrl) return;

    const printWindow = window.open(firstAttachment.dataUrl, "_blank", "noopener,noreferrer");
    if (printWindow) {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 800);
    }
  }

  useEffect(() => {
    async function fetchProvider() {
      try {
        const response = await fetch(`/spnc/app/api/service-providers/${params.id}`);
        const contentType = response.headers.get("content-type") || "";
        if (!response.ok || !contentType.includes("application/json")) {
          throw new Error(`Service provider request failed (${response.status})`);
        }
        const data = await response.json();
        setProvider(response.ok ? data.provider || null : null);
      } catch (error) {
        console.error("Fetch provider failed:", error);
      } finally {
        setLoading(false);
      }
    }
    if (params.id) fetchProvider();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white">
        <Loader2 size={32} className="animate-spin text-[#F2419B]" />
        <p className="text-sm font-semibold text-[#F2419B]">Loading</p>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white">
        <p className="text-sm text-gray-500">Service provider not found.</p>
        <button onClick={() => router.push("/spnc/app/service-providers")} className="text-sm text-[#F2419B] hover:underline">
          Back to Service Providers
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-8 py-10">
      <div className="print-hidden mb-8 flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push("/spnc/app/service-providers")}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft size={16} />
          Back to Service Providers
        </button>
        <button
          type="button"
          onClick={handlePrintPdf}
          className="flex items-center gap-2 rounded-md bg-[#F2419B] px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-[#D9297E]"
        >
          <Printer size={18} />
          Print
        </button>
      </div>

      <div className="mx-auto w-full max-w-6xl">
        {provider.attachments && provider.attachments.length > 0 && firstAttachment ? (
          <div className="overflow-hidden bg-white">
            <iframe
              src={firstAttachment.dataUrl}
              title={`${provider.name} PDF preview`}
              className="h-[85vh] w-full border-0 bg-white"
              style={{ backgroundColor: "white" }}
            />
          </div>
        ) : (
          <div className="flex min-h-[60vh] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500">
            No PDF attached.
          </div>
        )}
      </div>
    </div>
  );
}
