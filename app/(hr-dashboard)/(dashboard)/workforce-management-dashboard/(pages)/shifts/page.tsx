'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Clock, LayoutGrid, Calendar } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { ExportPrintDropdown } from '../../components/ui/ExportPrintDropdown';
import { CreateShiftModal } from '../../components/modals/CreateShiftModal';
import { CalendarModal } from '../../components/modals/CalendarModal';
import { useAuth } from '../../hooks/useAuth';
import { canCreateShifts } from '../../utils/rbac';
import { apiFetch } from '../../lib/apiFetch';
import type { Shift } from '../../types/workforce';
import type { CreateShiftPayload } from '../../types/api';

import { DailySnapshot } from '../../components/shifts/DailySnapshot';
import { SprintChart } from '../../components/shifts/SprintChart';

type ViewMode = 'daily' | 'timeline';

export default function ShiftsPage() {
  const { role } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [drivers, setDrivers] = useState<Array<{ id: string; full_name: string }>>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('daily');

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
            Manage daily schedules and track gate IN/OUT dispatch for riders.
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

      <div className="flex items-center gap-2 mb-2">
        <Button 
          variant={viewMode === 'daily' ? 'primary' : 'outline'} 
          onClick={() => setViewMode('daily')}
          className="text-xs"
        >
          <LayoutGrid size={14} />
          Daily Snapshot
        </Button>
        <Button 
          variant={viewMode === 'timeline' ? 'primary' : 'outline'} 
          onClick={() => setViewMode('timeline')}
          className="text-xs"
        >
          <Calendar size={14} />
          Sprint Chart
        </Button>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl text-xs text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}

      {viewMode === 'daily' ? (
        <DailySnapshot shifts={shifts} />
      ) : (
        <SprintChart shifts={shifts} />
      )}

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
