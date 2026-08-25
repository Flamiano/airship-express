import React from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ATTENDANCE_BADGE } from '@/utils/constants';
import type { AttendanceLog } from '@/types/workforce';

interface Card4Props {
 attendance: AttendanceLog[];
 connected: boolean;
}

/**
 * Card 4: Real-time Attendance Performance.
 * Live status stream from Supabase Realtime. Summary tiles for On-Shift / On-Break
 * / Tardy, then a scrollable list of employees with status badges that update
 * immediately when a row changes in the DB.
 */
export function Card4RealtimeAttendance({ attendance, connected }: Card4Props) {
 const onShift = attendance.filter((a) => a.status === 'On-Shift').length;
 const onBreak = attendance.filter((a) => a.status === 'On-Break').length;
 const tardy = attendance.filter((a) => a.status === 'Tardy').length;

 return (
 <Card className="p-5 space-y-4">
 <CardHeader
 title={
 <>
 Card 4: Real-time Attendance Performance
 <span
 className={`w-2 h-2 rounded-full ${
 connected ? 'bg-emerald-500 animate-ping' : 'bg-pink-400'
 }`}
 />
 </>
 }
 subtitle="Live active status stream synced via Supabase Realtime"
 action={
 <span
 className={`text-xs px-2.5 py-1 rounded-lg font-bold border ${
 connected
 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
 : 'bg-pink-50 text-pink-600 border-pink-200 '
 }`}
 >
 {connected ? '🟢 Realtime Active' : '⏳ Connecting'}
 </span>
 }
 />

 {/* Summary tiles */}
 <div className="grid grid-cols-3 gap-2">
 <div className="bg-emerald-50 border border-emerald-200 p-2 rounded-xl text-center">
 <p className="text-[10px] text-emerald-700 font-bold uppercase">Total On-Shift Now</p>
 <p className="text-lg font-bold text-emerald-800">{onShift}</p>
 </div>
 <div className="bg-pink-50 border border-pink-200 p-2 rounded-xl text-center">
 <p className="text-[10px] text-pink-700 font-bold uppercase">On Break</p>
 <p className="text-lg font-bold text-pink-800">{onBreak}</p>
 </div>
 <div className="bg-rose-50 border border-rose-200 p-2 rounded-xl text-center">
 <p className="text-[10px] text-rose-700 font-bold uppercase">Active Tardies</p>
 <p className="text-lg font-bold text-rose-600 animate-pulse">{tardy}</p>
 </div>
 </div>

 {/* Live feed */}
 <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
 {attendance.length === 0 && (
 <p className="text-xs text-pink-400 text-center py-6">No attendance records yet.</p>
 )}
 {attendance.map((emp) => (
 <div
 key={emp.id}
 className="flex items-center justify-between p-2.5 bg-pink-50/40 hover:bg-pink-50 rounded-xl border border-pink-100 transition"
 >
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-full bg-pink-200 text-pink-900 font-bold text-xs flex items-center justify-center">
 {emp.employee?.avatar_initials || '—'}
 </div>
 <div>
 <p className="text-xs font-bold text-pink-950">
 {emp.employee?.full_name || 'Unknown'}
 </p>
 <p className="text-[10px] text-pink-500">
 {emp.employee?.role} • {emp.terminal}
 </p>
 </div>
 </div>
 <div className="flex items-center gap-3">
 <span className="text-[10px] text-pink-400 font-mono hidden sm:inline">
 {formatScan(emp.last_scan)}
 </span>
 <Badge
 className={ATTENDANCE_BADGE[emp.status]}
 pulse={emp.status === 'Tardy'}
 >
 {emp.status}
 </Badge>
 </div>
 </div>
 ))}
 </div>
 </Card>
 );
}

function formatScan(iso: string): string {
 if (!iso) return 'N/A';
 const d = new Date(iso);
 if (Number.isNaN(d.getTime())) return iso;
 return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
