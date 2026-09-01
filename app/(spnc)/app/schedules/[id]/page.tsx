"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import DocumentLogo from "@/components/DocumentLogo";

type Schedule = {
  id: string;
  schedule_code: string;
  departure_datetime: string;
  arrival_datetime: string;
  frequency: string;
  day_of_week?: string | null;
  capacity?: number | null;
  unit_type: string;
  cutoff_hours: number;
  status: string;
  notes?: string | null;
  routes?: {
    route_code?: string;
    route_name: string;
    origin?: string;
    destination?: string;
    mode_of_transport?: string;
  } | null;
  service_providers?: { name: string } | null;
};

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "No date" : date.toLocaleString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ScheduleDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSchedule() {
      try {
        const response = await fetch(`/api/schedules/${params.id}`);
        const data = await response.json();
        setSchedule(response.ok ? data.schedule || null : null);
      } catch (error) {
        console.error("Fetch schedule failed:", error);
      } finally {
        setLoading(false);
      }
    }

    if (params.id) fetchSchedule();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white">
        <Loader2 size={32} className="animate-spin text-[#F2419B]" />
        <p className="text-sm font-semibold text-[#F2419B]">Loading</p>
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white">
        <p className="text-sm text-gray-500">Schedule not found.</p>
        <button onClick={() => router.push("/schedules")} className="text-sm text-[#F2419B] hover:underline">
          Back to Schedules
        </button>
      </div>
    );
  }

  const route = schedule.routes;
  const routeLabel = route?.route_code || route?.route_name || "Unassigned route";

  return (
    <div className="min-h-screen bg-white px-8 py-10">
      <div className="print-hidden mb-8 flex items-center justify-between">
        <button type="button" onClick={() => router.push("/schedules")} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900">
          <ArrowLeft size={16} />
          Back to Schedules
        </button>
        <button type="button" onClick={() => window.print()} className="flex items-center gap-2 rounded-md bg-[#F2419B] px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-[#D9297E]">
          <Printer size={18} />
          Print
        </button>
      </div>

      <div className="mx-auto max-w-3xl">
        <DocumentLogo />
        <h1 className="mt-2 text-3xl font-bold text-gray-900">{routeLabel}</h1>
        <p className="mt-2 text-sm text-gray-500">Schedule · {schedule.schedule_code}</p>
        <div className="mt-4 h-1 w-full bg-[#F2419B]" />

        <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-6 border border-gray-200 p-6">
          <div><p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Origin</p><p className="mt-1 text-sm text-gray-900">{route?.origin || "—"}</p></div>
          <div><p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Destination</p><p className="mt-1 text-sm text-gray-900">{route?.destination || "—"}</p></div>
          <div><p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Mode</p><p className="mt-1 text-sm text-gray-900">{route?.mode_of_transport || "—"}</p></div>
          <div><p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Departure</p><p className="mt-1 text-sm text-gray-900">{formatDateTime(schedule.departure_datetime)}</p></div>
          <div><p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Arrival</p><p className="mt-1 text-sm text-gray-900">{formatDateTime(schedule.arrival_datetime)}</p></div>
          <div><p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Service Provider</p><p className="mt-1 text-sm text-gray-900">{schedule.service_providers?.name || "—"}</p></div>
          <div><p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Status</p><p className="mt-1 text-sm text-gray-900 capitalize">{schedule.status}</p></div>
          <div><p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Frequency</p><p className="mt-1 text-sm text-gray-900 capitalize">{schedule.frequency.replace("_", " ")}{schedule.day_of_week ? ` · ${schedule.day_of_week}` : ""}</p></div>
          <div><p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Capacity</p><p className="mt-1 text-sm text-gray-900">{schedule.capacity ? `${schedule.capacity} ${schedule.unit_type}` : "—"}</p></div>
          <div><p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Booking Cutoff</p><p className="mt-1 text-sm text-gray-900">{schedule.cutoff_hours} hours before departure</p></div>
        </div>

        <div className="mt-8">
          <p className="border-b border-gray-200 pb-2 text-sm font-bold tracking-wide text-gray-900 uppercase">Notes</p>
          <p className="mt-4 text-sm leading-relaxed text-gray-800">{schedule.notes || "No notes added."}</p>
        </div>

        <div className="mt-16 flex items-center justify-between border-t border-gray-200 pt-3 text-xs text-gray-400">
          <span>{schedule.schedule_code}</span>
          <span>Airship Express</span>
        </div>
      </div>
    </div>
  );
}