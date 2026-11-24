"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  addCalendarDays,
  dateInputValue,
  formatMaintenanceDate,
  formatMaintenanceTime,
  getMaintenanceStatus,
  startOfWeek,
  STATUS_LABEL,
  type CalendarView,
  type MaintenanceRecord,
  type MaintenanceVehicle,
  type RecordStatus,
} from "./maintenanceTypes";

type Props = {
  records: MaintenanceRecord[];
  vehiclesById: Map<string, MaintenanceVehicle>;
  date: Date;
  view: CalendarView;
  onDateChange: (date: Date) => void;
  onViewChange: (view: CalendarView) => void;
  onSchedule: (date: Date) => void;
  onSelect: (record: MaintenanceRecord) => void;
};

const STATUS_STYLE: Record<string, string> = {
  scheduled: "border-pink-200 bg-pink-50 text-pink-800",
  in_progress: "border-amber-200 bg-amber-50 text-amber-900",
  overdue: "border-rose-200 bg-rose-50 text-rose-800",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  cancelled: "border-slate-200 bg-slate-50 text-slate-600",
};

export default function MaintenanceCalendar({ records, vehiclesById, date, view, onDateChange, onViewChange, onSchedule, onSelect }: Props) {
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  const weekStart = startOfWeek(date);
  const days = view === "month"
    ? Array.from({ length: 42 }, (_, index) => addCalendarDays(startOfWeek(monthStart), index))
    : Array.from({ length: 7 }, (_, index) => addCalendarDays(weekStart, index));
  const currentEvents = records.filter((record) => {
    const value = record.scheduled_at || record.performed_at || record.next_due_date;
    if (!value) return false;
    const eventDate = new Date(value);
    if (!Number.isFinite(eventDate.getTime())) return false;
    if (view === "agenda") return eventDate >= monthStart && eventDate < new Date(date.getFullYear(), date.getMonth() + 1, 1);
    const rangeStart = view === "month" ? startOfWeek(monthStart) : weekStart;
    const rangeEnd = addCalendarDays(rangeStart, view === "month" ? 42 : 7);
    return eventDate >= rangeStart && eventDate < rangeEnd;
  }).sort((left, right) => Date.parse(left.scheduled_at || left.performed_at || left.next_due_date || "") - Date.parse(right.scheduled_at || right.performed_at || right.next_due_date || ""));

  function shiftDate(direction: number) {
    const next = new Date(date);
    if (view === "month" || view === "agenda") next.setMonth(next.getMonth() + direction, 1);
    else next.setDate(next.getDate() + direction * 7);
    onDateChange(next);
  }

  function Event({ record, compact = false }: { record: MaintenanceRecord; compact?: boolean }) {
    const status = getMaintenanceStatus(record, vehiclesById.get(String(record.vehicle_id)));
    const plate = vehiclesById.get(String(record.vehicle_id))?.plate_number || record.vehicle_id;
    const tooltip = `${record.maintenance_category || "Category not recorded"} · ${record.maintenance_type} · ${plate} · ${STATUS_LABEL[status]}`;
    return <button type="button" title={tooltip} onClick={() => onSelect(record)} className={`w-full min-w-0 truncate rounded-md border text-left font-semibold transition hover:-translate-y-px hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 ${STATUS_STYLE[status]} ${compact ? "px-1 py-1 text-[9px]" : "px-2.5 py-2 text-[10px]"}`}>
      {compact ? `${formatMaintenanceTime(record.scheduled_at)} ${record.maintenance_type}` : <><span className="block truncate">{record.maintenance_type}</span><span className="mt-0.5 block truncate font-normal opacity-75">{plate} · {record.maintenance_category || "Category not recorded"}</span></>}
    </button>;
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-pink-100 bg-white shadow-[0_12px_30px_rgba(190,24,93,0.05)]">
      <header className="flex flex-col gap-3 border-b border-pink-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => shiftDate(-1)} aria-label="Previous period" className="rounded-lg border border-pink-100 p-2 text-slate-600 hover:bg-pink-50"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" onClick={() => onDateChange(new Date())} className="rounded-lg border border-pink-100 px-3 py-2 text-[10px] font-bold text-slate-600 hover:bg-pink-50">Today</button>
            <button type="button" onClick={() => shiftDate(1)} aria-label="Next period" className="rounded-lg border border-pink-100 p-2 text-slate-600 hover:bg-pink-50"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div><p className="text-[9px] font-black uppercase tracking-[0.14em] text-pink-700">Service calendar</p><h2 className="mt-0.5 text-lg font-black text-slate-900">{view === "week" ? `${formatMaintenanceDate(dateInputValue(days[0]), { month: "short", day: "numeric" })} – ${formatMaintenanceDate(dateInputValue(days[6]), { month: "short", day: "numeric", year: "numeric" })}` : date.toLocaleDateString("en-PH", { month: "long", year: "numeric" })}</h2></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Calendar view" className="flex rounded-lg bg-pink-50 p-1">
            {(["month", "week", "agenda"] as CalendarView[]).map((mode) => <button key={mode} type="button" role="tab" aria-selected={view === mode} onClick={() => onViewChange(mode)} className={`rounded-md px-3 py-1.5 text-[10px] font-bold capitalize ${view === mode ? "bg-white text-pink-700 shadow-sm" : "text-slate-500 hover:text-pink-700"}`}>{mode}</button>)}
          </div>
          <button type="button" onClick={() => onSchedule(date)} className="inline-flex items-center gap-1.5 rounded-lg bg-pink-700 px-3 py-2 text-[10px] font-bold text-white hover:bg-pink-800"><Plus className="h-3.5 w-3.5" />Schedule</button>
        </div>
      </header>

      {view === "agenda" ? <div className="divide-y divide-pink-100">
        {currentEvents.length ? currentEvents.map((record) => <div key={record.id} className="grid gap-2 p-3 sm:grid-cols-[125px_minmax(0,1fr)] sm:items-center sm:px-5"><div className="text-[10px] font-semibold text-slate-500">{formatMaintenanceDate(record.scheduled_at || record.performed_at || record.next_due_date)}<span className="ml-2 text-slate-400">{formatMaintenanceTime(record.scheduled_at)}</span></div><Event record={record} /></div>) : <div className="grid min-h-48 place-items-center text-center"><div><CalendarDays className="mx-auto h-7 w-7 text-pink-300" /><p className="mt-2 text-sm font-bold text-slate-700">No services in this month</p><button type="button" onClick={() => onSchedule(date)} className="mt-2 text-xs font-bold text-pink-700">Schedule maintenance</button></div></div>}
      </div> : <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-7 border-b border-pink-100 bg-[#fff9fc] text-center text-[9px] font-black uppercase tracking-wide text-slate-400">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="py-2.5">{day}</div>)}</div>
          <div className="grid grid-cols-7 border-l border-pink-100">{days.map((day) => {
            const key = dateInputValue(day);
            const dayEvents = currentEvents.filter((record) => dateInputValue(new Date(record.scheduled_at || record.performed_at || record.next_due_date || "")) === key);
            const isToday = key === dateInputValue(new Date());
            const inMonth = day.getMonth() === date.getMonth();
            return <div key={key} className={`min-h-[116px] border-b border-r border-pink-100 p-1.5 sm:min-h-[138px] ${view === "month" && !inMonth ? "bg-slate-50/70" : "bg-white"}`}>
              <button type="button" onClick={() => onSchedule(day)} aria-label={`Schedule service on ${formatMaintenanceDate(key)}`} className={`mb-1 flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[10px] font-bold ${isToday ? "bg-pink-700 text-white" : inMonth ? "text-slate-600 hover:bg-pink-100" : "text-slate-300"}`}>{day.getDate()}</button>
              <div className="space-y-1">{dayEvents.slice(0, 3).map((record) => <Event key={record.id} record={record} compact />)}{dayEvents.length > 3 && <button type="button" onClick={() => { onDateChange(day); onViewChange("agenda"); }} className="px-1 text-[9px] font-bold text-pink-700">+{dayEvents.length - 3} more</button>}</div>
            </div>;
          })}</div>
        </div>
      </div>}
      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-pink-100 bg-[#fffafd] px-4 py-2 text-[9px] text-slate-500"><span className="font-bold uppercase tracking-wide">Status</span>{(["scheduled", "in_progress", "overdue", "completed", "cancelled"] as RecordStatus[]).map((status) => <span key={status} className="flex items-center gap-1.5"><i className={`h-2 w-2 rounded-full ${status === "scheduled" ? "bg-pink-500" : status === "in_progress" ? "bg-amber-500" : status === "overdue" ? "bg-rose-600" : status === "completed" ? "bg-emerald-500" : "bg-slate-400"}`} />{STATUS_LABEL[status]}</span>)}</footer>
    </section>
  );
}