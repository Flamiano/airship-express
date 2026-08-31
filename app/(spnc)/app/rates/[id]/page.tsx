"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import DocumentLogo from "@/components/DocumentLogo";

type Rate = {
  rate_code: string;
  description?: string | null;
  charge_type: string;
  currency: string;
  base_rate: number;
  min_charge?: number | null;
  surcharge_pct?: number | null;
  valid_from?: string | null;
  valid_to?: string | null;
  status: string;
  notes?: string | null;
  routes?: {
    route_code?: string;
    route_name?: string;
    origin?: string;
    destination?: string;
    mode_of_transport?: string;
    transit_points?: string[];
  } | null;
  service_providers?: { name: string } | null;
};

const currencySymbols: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", JPY: "¥", CNY: "¥" };

export default function RateDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [rate, setRate] = useState<Rate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRate() {
      try {
        const response = await fetch(`/api/rates/${params.id}`);
        const data = await response.json();
        setRate(response.ok ? data.rate || null : null);
      } catch (error) {
        console.error("Fetch rate failed:", error);
      } finally {
        setLoading(false);
      }
    }
    if (params.id) fetchRate();
  }, [params.id]);

  if (loading) {
    return <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white"><Loader2 size={32} className="animate-spin text-[#F2419B]" /><p className="text-sm font-semibold text-[#F2419B]">Loading</p></div>;
  }

  if (!rate) {
    return <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white"><p className="text-sm text-gray-500">Rate not found.</p><button onClick={() => router.push("/rates")} className="text-sm text-[#F2419B] hover:underline">Back to Rates</button></div>;
  }

  const route = rate.routes;
  const symbol = currencySymbols[rate.currency] || `${rate.currency} `;

  return (
    <div className="min-h-screen bg-white px-8 py-10">
      <div className="print-hidden mb-8 flex items-center justify-between">
        <button type="button" onClick={() => router.push("/rates")} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"><ArrowLeft size={16} />Back to Rates</button>
        <button type="button" onClick={() => window.print()} className="flex items-center gap-2 rounded-md bg-[#F2419B] px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-[#D9297E]"><Printer size={18} />Print</button>
      </div>
      <div className="mx-auto max-w-3xl">
        <DocumentLogo />
        <h1 className="mt-2 text-3xl font-bold text-gray-900">{rate.description || rate.rate_code}</h1>
        <p className="mt-2 text-sm text-gray-500">Rate & Tariff · {rate.rate_code}</p>
        <div className="mt-4 h-1 w-full bg-[#F2419B]" />
        <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-6 border border-gray-200 p-6">
          <div><p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Origin</p><p className="mt-1 text-sm text-gray-900">{route?.origin || "—"}</p></div>
          <div><p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Destination</p><p className="mt-1 text-sm text-gray-900">{route?.destination || "—"}</p></div>
          <div><p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Charge Type</p><p className="mt-1 text-sm text-gray-900 capitalize">{rate.charge_type.replaceAll("_", " ")}</p></div>
          <div><p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Base Rate</p><p className="mt-1 text-sm text-gray-900">{symbol}{rate.base_rate.toLocaleString()}</p></div>
          <div><p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Minimum Charge</p><p className="mt-1 text-sm text-gray-900">{rate.min_charge == null ? "—" : `${symbol}${rate.min_charge.toLocaleString()}`}</p></div>
          <div><p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Surcharge</p><p className="mt-1 text-sm text-gray-900">{rate.surcharge_pct || 0}%</p></div>
          <div><p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Valid From</p><p className="mt-1 text-sm text-gray-900">{rate.valid_from || "—"}</p></div>
          <div><p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Valid To</p><p className="mt-1 text-sm text-gray-900">{rate.valid_to || "—"}</p></div>
          <div><p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Service Provider</p><p className="mt-1 text-sm text-gray-900">{rate.service_providers?.name || "—"}</p></div>
          <div><p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Status</p><p className="mt-1 text-sm text-gray-900 capitalize">{rate.status}</p></div>
          {route?.transit_points && route.transit_points.length > 0 && <div className="col-span-2"><p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Transit Points</p><p className="mt-1 text-sm text-gray-900">{route.transit_points.join(" → ")}</p></div>}
        </div>
        <div className="mt-8"><p className="border-b border-gray-200 pb-2 text-sm font-bold tracking-wide text-gray-900 uppercase">Notes</p><p className="mt-4 text-sm leading-relaxed text-gray-800">{rate.notes || "No notes added."}</p></div>
        <div className="mt-16 flex items-center justify-between border-t border-gray-200 pt-3 text-xs text-gray-400"><span>{rate.rate_code}</span><span>Airship Express</span></div>
      </div>
    </div>
  );
}