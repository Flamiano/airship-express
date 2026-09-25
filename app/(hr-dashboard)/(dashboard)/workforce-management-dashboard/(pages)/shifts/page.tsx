'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Clock, Users, Truck, LogIn, CalendarDays } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { ExportPrintDropdown } from '../../components/ui/ExportPrintDropdown';
import { CreateShiftModal } from '../../components/modals/CreateShiftModal';
import { CalendarModal } from '../../components/modals/CalendarModal';
import { useAuth } from '../../hooks/useAuth';
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

  const [editingShift, setEditingShift] = useState<Shift | null>(null);

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

  const handleCreateOrUpdate = async (payload: any) => {
    if (editingShift) {
      // Mock update path since we intercept this anyway
      await apiFetch<Shift>(`/api/shifts/${editingShift.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch<Shift>('/api/shifts', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
    await load();
  };

  // Group shifts by category
  const officeShifts = shifts.filter(s => s.employee?.employee_group === 'Office');
  const expectedRiders = shifts.filter(
    s => (s.employee?.employee_group === 'Employed Rider' || s.employee?.employee_group === 'Third-Party Rider') && !s.gate_in
  );
  const activeRiders = shifts.filter(
    s => (s.employee?.employee_group === 'Employed Rider' || s.employee?.employee_group === 'Third-Party Rider') && s.gate_in
  );

  const renderOfficeCard = (shift: Shift) => (
    <Card 
      key={shift.id} 
      className="p-4 space-y-3 border-l-4 border-l-accent hover:border-l-accent/80 transition-colors cursor-pointer group"
      onClick={() => setEditingShift(shift)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-[11px] font-bold text-accent">
            {shift.employee?.avatar_initials}
          </div>
          <div>
            <h3 className="font-semibold text-ink text-sm group-hover:text-accent transition-colors">{shift.employee?.full_name || 'Unassigned'}</h3>
            <p className="text-[10px] text-muted uppercase tracking-wider">{shift.employee?.department || 'Office'}</p>
          </div>
        </div>
        <Badge className={shift.status === 'In Progress' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-ink/[0.06] text-muted border-line'}>
          {shift.status}
        </Badge>
      </div>
      <div className="bg-paper-dark rounded-lg p-2.5 flex items-center justify-between text-xs border border-line">
        <div className="flex items-center gap-1.5 text-ink">
          <Clock size={14} className="text-muted" />
          <span className="font-medium">{shift.shift_time || '08:00 AM - 05:00 PM'}</span>
        </div>
      </div>
      {shift.override_reason && (
        <p className="text-[10px] text-amber-600/80 italic mt-2">Override: {shift.override_reason}</p>
      )}
    </Card>
  );

  const renderRiderCard = (shift: Shift, isExpected: boolean) => (
    <Card 
      key={shift.id} 
      className={`p-4 space-y-3 border-l-4 transition-colors cursor-pointer group ${isExpected ? 'border-l-amber-500 hover:border-l-amber-600' : 'border-l-emerald-500 hover:border-l-emerald-600'}`}
      onClick={() => setEditingShift(shift)}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-ink text-sm flex items-center gap-2 group-hover:text-amber-600 transition-colors">
            {shift.employee?.full_name || 'Unassigned'}
            {shift.employee?.employee_group === 'Third-Party Rider' && (
              <span className="text-[9px] bg-slate-500/10 text-slate-500 px-1.5 py-0.5 rounded uppercase tracking-wider font-bold border border-slate-500/20">
                3rd Party
              </span>
            )}
          </h3>
          <p className="text-[10px] text-muted uppercase tracking-wider mt-0.5">{shift.employee?.department || 'Fleet'}</p>
        </div>
        <Badge className={isExpected ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'}>
          {isExpected ? 'Pending Arrival' : 'Active / Loading'}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-paper-dark rounded-lg p-2 flex flex-col gap-1 border border-line">
          <span className="text-[10px] text-muted font-medium uppercase tracking-wider">Target Time</span>
          <div className="flex items-center gap-1.5 text-ink font-medium">
            <Clock size={12} className="text-amber-500" />
            {shift.expected_arrival || 'N/A'}
          </div>
        </div>
        <div className="bg-paper-dark rounded-lg p-2 flex flex-col gap-1 border border-line">
          <span className="text-[10px] text-muted font-medium uppercase tracking-wider">Gate IN</span>
          <div className="flex items-center gap-1.5 text-ink font-medium">
            <LogIn size={12} className={shift.gate_in ? 'text-emerald-500' : 'text-muted'} />
            {shift.gate_in || '--:--'}
          </div>
        </div>
      </div>
      
      {shift.vehicle && (
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <Truck size={12} />
          <span>Assigned: <span className="font-medium text-ink">{shift.vehicle}</span></span>
        </div>
      )}
      {shift.override_reason && (
        <p className="text-[10px] text-amber-600/80 italic mt-2">Override: {shift.override_reason}</p>
      )}
    </Card>
  );

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-paper p-5 rounded-2xl border border-line shadow-sm mb-6">
        <div>
          <h1 className="text-xl font-bold text-ink">Active Operations Dashboard</h1>
          <p className="text-xs text-muted mt-1">
            Real-time view of office schedules and rider gate dispatches.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportPrintDropdown />
          <Button onClick={() => setCalendarOpen(true)} variant="secondary">
            <CalendarDays size={16} />
            View Calendar
          </Button>
          {canCreateShifts(role) && (
            <Button onClick={() => { setEditingShift(null); setModalOpen(true); }} variant="primary">
              <Plus size={16} />
              Create Shift Assignment
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl text-xs text-rose-600 dark:text-rose-400 mb-6">
          {error}
        </div>
      )}

      {/* Grid Layout: 3 Columns for large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
        
        {/* Column 1: Office Staff */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2 mb-1 border-b border-line pb-2">
            <Users size={16} className="text-accent" />
            <h2 className="text-sm font-bold text-ink uppercase tracking-wider">Office Staff</h2>
            <span className="ml-auto text-xs font-bold text-muted bg-paper-dark px-2 py-0.5 rounded-full">{officeShifts.length}</span>
          </div>
          {officeShifts.length > 0 ? (
            <div className="flex flex-col gap-3">
              {officeShifts.map(renderOfficeCard)}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-muted border border-dashed border-line rounded-xl">No office shifts scheduled today.</div>
          )}
        </section>

        {/* Column 2: Expected Riders */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2 mb-1 border-b border-line pb-2">
            <Clock size={16} className="text-amber-500" />
            <h2 className="text-sm font-bold text-ink uppercase tracking-wider">Expected Riders</h2>
            <span className="ml-auto text-xs font-bold text-muted bg-paper-dark px-2 py-0.5 rounded-full">{expectedRiders.length}</span>
          </div>
          {expectedRiders.length > 0 ? (
            <div className="flex flex-col gap-3">
              {expectedRiders.map(shift => renderRiderCard(shift, true))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-muted border border-dashed border-line rounded-xl">No pending arrivals.</div>
          )}
        </section>

        {/* Column 3: Active / Inside Riders */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2 mb-1 border-b border-line pb-2">
            <LogIn size={16} className="text-emerald-500" />
            <h2 className="text-sm font-bold text-ink uppercase tracking-wider">Inside / Loading</h2>
            <span className="ml-auto text-xs font-bold text-muted bg-paper-dark px-2 py-0.5 rounded-full">{activeRiders.length}</span>
          </div>
          {activeRiders.length > 0 ? (
            <div className="flex flex-col gap-3">
              {activeRiders.map(shift => renderRiderCard(shift, false))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-muted border border-dashed border-line rounded-xl">No active riders inside.</div>
          )}
        </section>

      </div>

      <CreateShiftModal
        open={modalOpen || !!editingShift}
        onClose={() => { setModalOpen(false); setEditingShift(null); }}
        onSubmit={handleCreateOrUpdate}
        drivers={drivers}
        initialData={editingShift}
      />

      <CalendarModal
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        shifts={shifts}
        onShiftClick={(shift) => {
          setCalendarOpen(false);
          setEditingShift(shift);
        }}
      />
    </>
  );
}
