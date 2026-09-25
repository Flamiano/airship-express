'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Users, Truck, Clock } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ExportPrintDropdown } from '../../components/ui/ExportPrintDropdown';
import { CreateShiftModal } from '../../components/modals/CreateShiftModal';
import { CalendarModal } from '../../components/modals/CalendarModal';
import { useAuth } from '../../hooks/useAuth';
import { SHIFT_PRIORITY_BADGE } from '../../utils/constants';
import { canCreateShifts } from '../../utils/rbac';
import { apiFetch } from '../../lib/apiFetch';
import type { Shift } from '../../types/workforce';
import type { CreateShiftPayload } from '../../types/api';

export default function ShiftsPage() {
 const { role } = useAuth();
 const [shifts, setShifts] = useState<Shift[]>([]);
 const [drivers, setDrivers] = useState<Array<{ id: string; full_name: string }>>([]);
 const [modalOpen, setModalOpen] = useState(false);
 const [calendarOpen, setCalendarOpen] = useState(false);
 const [error, setError] = useState<string | null>(null);

 const load = useCallback(async () => {
 try {
 const data = await apiFetch<Shift[]>('/api/shifts');
 setShifts(data || []);
 } catch (err) {
 setError(err instanceof Error ? err.message : 'Failed to load shifts');
 }
 }, []);

 useEffect(() => {
 load();
 apiFetch<Array<{ id: string; full_name: string }>>('/api/drivers')
 .then(res => setDrivers(res || []))
 .catch(() => setDrivers([]));
 }, [load]);

 const handleCreate = async (payload: CreateShiftPayload) => {
 await apiFetch<Shift>('/api/shifts', {
 method: 'POST',
 body: JSON.stringify(payload),
 });
 await load();
 };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-paper p-5 rounded-2xl border border-line shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-ink">Shift & Schedule Management</h1>
          <p className="text-xs text-muted mt-1">
            Assign drivers to freight vehicles, manage route times, and handle coverage gaps.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportPrintDropdown />
          <Button onClick={() => setCalendarOpen(true)} variant="secondary">
            <Clock size={16} />
            View Calendar
          </Button>
          {canCreateShifts(role) && (
            <Button onClick={() => setModalOpen(true)} variant="primary">
              <Plus size={16} />
              Create Shift Assignment
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl text-xs text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {shifts.map((shift) => (
          <Card key={shift.id} className="p-5 space-y-3 hover:border-accent/30 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-medium text-muted">
                {shift.id.slice(0, 8)}
              </span>
              <Badge className={SHIFT_PRIORITY_BADGE[shift.priority]}>
                {shift.priority} Priority
              </Badge>
            </div>

            <h3 className="font-semibold text-ink text-base">{shift.title}</h3>

            <div className="space-y-1.5 text-xs">
              <p className="flex items-center gap-2 text-ink">
                <Users size={14} className="text-accent" />
                <span className="font-medium text-muted">Driver:</span>{' '}
                {shift.driver?.full_name || 'Unassigned'}
              </p>
              <p className="flex items-center gap-2 text-ink">
                <Truck size={14} className="text-accent" />
                <span className="font-medium text-muted">Vehicle:</span> {shift.vehicle}
              </p>
              <p className="flex items-center gap-2 text-ink">
                <Clock size={14} className="text-accent" />
                <span className="font-medium text-muted">Time:</span> {shift.shift_date} • {shift.shift_time}
              </p>
            </div>

            <div className="pt-2 border-t border-line flex items-center justify-between">
              <span className="text-xs text-muted font-medium">Status: {shift.status}</span>
            </div>
          </Card>
        ))}
        {shifts.length === 0 && !error && (
          <p className="text-xs text-muted col-span-full text-center py-8">
            No shifts scheduled yet.
          </p>
        )}
      </div>

      <CreateShiftModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
        drivers={drivers}
      />

      <CalendarModal
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
      />
    </>
  );
}
