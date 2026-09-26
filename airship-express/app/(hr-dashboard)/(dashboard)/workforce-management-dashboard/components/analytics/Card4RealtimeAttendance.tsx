import React from 'react';
import { Card, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { ATTENDANCE_BADGE } from '../../utils/constants';
import type { AttendanceLog } from '../../types/workforce';

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
            Real-time Attendance Performance
            <span
              className={`w-2 h-2 rounded-full ${
                connected ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'
              }`}
            />
          </>
        }
        subtitle="Live active status stream synced via Supabase Realtime"
        action={
          <span
            className={`text-xs px-2.5 py-1 rounded-lg font-medium border ${
              connected
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
            }`}
          >
            {connected ? '🟢 Realtime Active' : '⏳ Connecting'}
          </span>
        }
      />

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-xl text-center">
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase">Total On-Shift Now</p>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{onShift}</p>
        </div>
        <div className="bg-accent/10 border border-accent/20 p-2 rounded-xl text-center">
          <p className="text-[10px] text-accent font-semibold uppercase">On Break</p>
          <p className="text-lg font-bold text-accent">{onBreak}</p>
        </div>
        <div className="bg-rose-500/10 border border-rose-500/20 p-2 rounded-xl text-center">
          <p className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold uppercase">Active Tardies</p>
          <p className="text-lg font-bold text-rose-500 animate-pulse">{tardy}</p>
        </div>
      </div>

      {/* Live feed */}
      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
        {attendance.length === 0 && (
          <p className="text-xs text-muted text-center py-6">No attendance records yet.</p>
        )}
        {attendance.map((emp) => (
          <div
            key={emp.id}
            className="flex items-center justify-between p-2.5 bg-ink/[0.02] dark:bg-paper/[0.04] hover:bg-ink/[0.04] dark:hover:bg-paper/[0.08] rounded-xl border border-line transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-accent/15 text-accent font-bold text-xs flex items-center justify-center">
                {emp.employee?.avatar_initials || '—'}
              </div>
              <div>
                <p className="text-xs font-semibold text-ink">
                  {emp.employee?.full_name || 'Unknown'}
                </p>
                <p className="text-[10px] text-muted">
                  {emp.employee?.role} • {emp.terminal}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-muted font-mono hidden sm:inline">
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
