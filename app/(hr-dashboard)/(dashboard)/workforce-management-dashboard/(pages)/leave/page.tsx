'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LeaveRequestModal } from '../../components/modals/LeaveRequestModal';
import { useAuth } from '../../hooks/useAuth';
import { LEAVE_BADGE } from '../../utils/constants';
import { canApproveLeave, canRequestLeave } from '../../utils/rbac';
import { apiFetch } from '../../lib/apiFetch';
import type { LeaveRequest } from '../../types/workforce';
import type { CreateLeavePayload } from '../../types/api';

export default function LeavePage() {
 const { role } = useAuth();
 const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
 const [modalOpen, setModalOpen] = useState(false);
 const [error, setError] = useState<string | null>(null);

 const load = useCallback(async () => {
 try {
 const data = await apiFetch<LeaveRequest[]>('/api/leave');
 setLeaves(data);
 } catch (err) {
 setError(err instanceof Error ? err.message : 'Failed to load leave requests');
 }
 }, []);

 useEffect(() => {
 load();
 }, [load]);

 const handleCreate = async (payload: CreateLeavePayload) => {
 await apiFetch<LeaveRequest>('/api/leave', {
 method: 'POST',
 body: JSON.stringify(payload),
 });
 await load();
 };

 const approve = async (id: string) => {
 try {
 await apiFetch<LeaveRequest>('/api/leave', {
 method: 'PATCH',
 body: JSON.stringify({ id, status: 'Approved' }),
 });
 await load();
 } catch (err) {
 setError(err instanceof Error ? err.message : 'Failed to approve');
 }
 };

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-paper p-5 rounded-2xl border border-line shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-ink">Leave & Fatigue Rest Management</h1>
          <p className="text-xs text-muted mt-1">
            Track mandatory rest periods for heavy-haul drivers, PTO requests, and medical leaves.
          </p>
        </div>
        {canRequestLeave(role) && (
          <Button onClick={() => setModalOpen(true)} variant="primary">
            <Plus size={16} />
            Request Leave / Rest
          </Button>
        )}
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl text-xs text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}

      <Card className="p-5 space-y-4">
        <h3 className="font-semibold text-ink text-sm">Active Requests Queue</h3>
        <div className="space-y-3">
          {leaves.map((lv) => (
            <div
              key={lv.id}
              className="p-4 bg-ink/[0.02] dark:bg-paper/[0.04] rounded-xl border border-line flex flex-col md:flex-row md:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-ink text-sm">
                    {lv.employee?.full_name || 'Unknown'}
                  </span>
                  <span className="text-[10px] font-mono text-muted">({lv.id.slice(0, 8)})</span>
                </div>
                <p className="text-xs text-muted font-medium">
                  {lv.leave_type} •{' '}
                  <span className="font-semibold text-ink">
                    {lv.start_date} – {lv.end_date}
                  </span>{' '}
                  ({lv.days_count} Days)
                </p>
                {lv.balance_remaining != null && (
                  <p className="text-[11px] text-muted">
                    Leave Balance Remaining: {lv.balance_remaining} Days
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Badge className={LEAVE_BADGE[lv.status]}>{lv.status}</Badge>
                {canApproveLeave(role) && lv.status !== 'Approved' && (
                  <Button size="sm" variant="primary" onClick={() => approve(lv.id)}>
                    Approve Rest
                  </Button>
                )}
              </div>
            </div>
          ))}
          {leaves.length === 0 && !error && (
            <p className="text-xs text-muted text-center py-8">No leave requests yet.</p>
          )}
        </div>
      </Card>

      <LeaveRequestModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
      />
    </DashboardLayout>

 );
}
