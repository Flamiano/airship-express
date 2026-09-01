"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Printer, Star } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import DocumentLogo from "@/components/DocumentLogo";

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

  useEffect(() => {
    async function fetchProvider() {
      try {
        const response = await fetch(`/api/service-providers/${params.id}`);
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
        <button onClick={() => router.push("/service-providers")} className="text-sm text-[#F2419B] hover:underline">
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
          onClick={() => router.push("/service-providers")}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft size={16} />
          Back to Service Providers
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-md bg-[#F2419B] px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-[#D9297E]"
        >
          <Printer size={18} />
          Print
        </button>
      </div>

      <div className="mx-auto max-w-3xl">
        <DocumentLogo />
        <h1 className="mt-2 text-3xl font-bold text-gray-900">{provider.name}</h1>
        <p className="mt-2 text-sm text-gray-500">
          Service Provider · {TYPE_LABELS[provider.type] || provider.type}
        </p>

        <div className="mt-4 h-1 w-full bg-[#F2419B]" />

        <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-6 border border-gray-200 p-6">
          <div>
            <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Contact Person</p>
            <p className="mt-1 text-sm text-gray-900">{provider.contact_person || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Email</p>
            <p className="mt-1 text-sm text-gray-900">{provider.email || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Phone</p>
            <p className="mt-1 text-sm text-gray-900">{provider.phone || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Country</p>
            <p className="mt-1 text-sm text-gray-900">{provider.country || "—"}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Address</p>
            <p className="mt-1 text-sm text-gray-900">{provider.address || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Service Modes</p>
            <p className="mt-1 text-sm text-gray-900">
              {provider.service_modes && provider.service_modes.length > 0
                ? provider.service_modes.join(", ")
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Contract Ref</p>
            <p className="mt-1 text-sm text-gray-900">{provider.contract_ref || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Status</p>
            <p className="mt-1 text-sm text-gray-900 capitalize">{provider.status}</p>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Rating</p>
            <div className="mt-1 flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  size={14}
                  className={n <= provider.rating ? "fill-[#F2A23B] text-[#F2A23B]" : "text-gray-300"}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8">
          <p className="border-b border-gray-200 pb-2 text-sm font-bold tracking-wide text-gray-900 uppercase">
            Notes
          </p>
          <p className="mt-4 text-sm leading-relaxed text-gray-800">{provider.notes || "No notes added."}</p>
        </div>

        <div className="mt-16 flex items-center justify-between border-t border-gray-200 pt-3 text-xs text-gray-400">
          <span>{provider.contract_ref || provider.name}</span>
          <span>Airship Express</span>
        </div>
      </div>
    </div>
  );
}
