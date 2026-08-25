import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { useAuth } from '@/hooks/useAuth';
import { TIMESHEET_BADGE } from '@/utils/constants';
import { canApproveTimesheets } from '@/utils/rbac';
import { apiFetch } from '@/lib/apiFetch';
import type { Timesheet } from '@/types/workforce';

export default function TimesheetsPage() {
 const { role } = useAuth();
 const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
 const [error, setError] = useState<string | null>(null);

 const load = useCallback(async () => {
 try {
 const data = await apiFetch<Timesheet[]>('/api/timesheets');
 setTimesheets(data);
 } catch (err) {
 setError(err instanceof Error ? err.message : 'Failed to load timesheets');
 }
 }, []);

 useEffect(() => {
 load();
 }, [load]);

 const updateStatus = async (id: string, status: 'Approved' | 'Flagged Overtime') => {
 try {
 await apiFetch<Timesheet>('/api/timesheets', {
 method: 'PATCH',
 body: JSON.stringify({ id, status }),
 });
 await load();
 } catch (err) {
 setError(err instanceof Error ? err.message : 'Failed to update timesheet');
 }
 };

 const pendingCount = timesheets.filter(
 (t) => t.status === 'Pending Approval' || t.status === 'Flagged Overtime'
 ).length;

 return (
 <DashboardLayout>
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-pink-100 shadow-sm">
 <div>
 <h1 className="text-xl font-bold text-pink-950">Electronic Timesheet Workflow</h1>
 <p className="text-xs text-pink-600">
 Review hours logged, approve overtime, and sync data to payroll.
 </p>
 </div>
 {pendingCount > 0 && (
 <span className="text-xs bg-pink-100 text-pink-700 px-3 py-1 rounded-full font-bold border border-pink-200">
 {pendingCount} Pending Review
 </span>
 )}
 </div>

 {error && (
 <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-xs text-rose-800">
 {error}
 </div>
 )}

 <Card className="p-5 space-y-4">
 <Table>
 <THead>
 <TR header>
 <TH>Timesheet ID</TH>
 <TH>Employee</TH>
 <TH>Period</TH>
 <TH>Freight Ref</TH>
 <TH>Total Hours</TH>
 <TH>Overtime</TH>
 <TH>Est. Pay</TH>
 <TH>Status</TH>
 {canApproveTimesheets(role) && <TH className="text-right">Actions</TH>}
 </TR>
 </THead>
 <TBody>
 {timesheets.map((ts) => (
 <TR key={ts.id}>
 <TD className="font-mono font-bold text-pink-600">{ts.id.slice(0, 8)}</TD>
 <TD className="font-bold text-pink-950">{ts.employee?.full_name || 'Unknown'}</TD>
 <TD className="text-pink-600">
 {ts.week_start} – {ts.week_end}
 </TD>
 <TD className="text-pink-800 font-mono">{ts.load_ref || '—'}</TD>
 <TD className="font-bold text-pink-950">{ts.total_hours} hrs</TD>
 <TD className="text-rose-600 font-bold">{ts.overtime_hours} hrs</TD>
 <TD className="font-bold text-emerald-700">
 ${ts.total_pay?.toFixed(2) || '0.00'}
 </TD>
 <TD>
 <Badge className={TIMESHEET_BADGE[ts.status]}>{ts.status}</Badge>
 </TD>
 {canApproveTimesheets(role) && (
 <TD className="text-right space-x-2">
 {ts.status !== 'Approved' && (
 <Button
 size="sm"
 variant="success"
 onClick={() => updateStatus(ts.id, 'Approved')}
 >
 Approve
 </Button>
 )}
 {ts.status !== 'Flagged Overtime' && (
 <Button
 size="sm"
 variant="secondary"
 onClick={() => updateStatus(ts.id, 'Flagged Overtime')}
 >
 Flag OT
 </Button>
 )}
 </TD>
 )}
 </TR>
 ))}
 </TBody>
 </Table>
 {timesheets.length === 0 && !error && (
 <p className="text-xs text-pink-400 text-center py-8">No timesheets yet.</p>
 )}
 </Card>
 </DashboardLayout>
 );
}
