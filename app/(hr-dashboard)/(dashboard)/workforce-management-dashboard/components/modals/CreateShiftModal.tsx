import React, { useEffect, useRef, useState } from 'react';
import { Plus, Edit3 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SHIFT_PRIORITIES } from '../../utils/constants';
import type { CreateShiftPayload, UpdateShiftPayload } from '../../types/api';
import { getEmployeeGroup, type Shift, type ShiftStatus } from '../../types/workforce';

interface CreateShiftModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateShiftPayload | UpdateShiftPayload) => Promise<void>;
  drivers: Array<{ id: string; full_name: string; role?: string }>;
  initialData?: Shift | null;
}

/**
 * Form modal for creating a new shift assignment. Called from the shifts page.
 * Submits to POST /api/shifts.
 */
export function CreateShiftModal({ open, onClose, onSubmit, drivers, initialData }: CreateShiftModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'office' | 'rider'>('office');
  const defaulted = useRef(false);

  const [form, setForm] = useState<Partial<UpdateShiftPayload>>({
    title: '',
    driver_id: drivers.length ? drivers[0].id : '',
    shift_date: new Date().toISOString().split('T')[0],
    shift_time: '08:00 AM - 05:00 PM',
    vehicle: 'Freightliner Cascadia #902',
    expected_arrival: '09:00 AM',
    priority: 'Normal',
    override_reason: '',
    status: 'Scheduled',
  });

  useEffect(() => {
    if (open) {
      if (initialData) {
        const isOffice = getEmployeeGroup(initialData.employee?.role) === 'Office';
        setMode(isOffice ? 'office' : 'rider');
        setForm({
          id: initialData.id,
          title: initialData.title || '',
          driver_id: initialData.employee_id,
          shift_date: initialData.shift_date,
          shift_time: initialData.shift_time || '08:00 AM - 05:00 PM',
          break_duration_minutes: initialData.break_duration_minutes,
          vehicle: initialData.vehicle || '',
          expected_arrival: initialData.expected_arrival || '',
          priority: initialData.priority || 'Normal',
          override_reason: initialData.override_reason || '',
          status: initialData.status || 'Scheduled',
        });
      } else if (!defaulted.current) {
        defaulted.current = true;
        setMode('office');
        setForm({
          title: '',
          driver_id: drivers.length ? drivers[0].id : '',
          shift_date: new Date().toISOString().split('T')[0],
          shift_time: '08:00 AM - 05:00 PM',
          vehicle: 'Freightliner Cascadia #902',
          expected_arrival: '09:00 AM',
          priority: 'Normal',
          override_reason: '',
          status: 'Scheduled',
        });
      }
    } else {
      defaulted.current = false;
    }
  }, [open, drivers, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload: CreateShiftPayload | UpdateShiftPayload = {
        title: form.title!,
        driver_id: form.driver_id || null,
        shift_date: form.shift_date!,
      };

      if (mode === 'office') {
        payload.shift_time = form.shift_time;
      } else {
        payload.vehicle = form.vehicle;
        payload.expected_arrival = form.expected_arrival;
        payload.priority = form.priority as 'Normal'|'High'|'Critical';
      }

      if (initialData) {
        (payload as UpdateShiftPayload).id = initialData.id;
        (payload as UpdateShiftPayload).override_reason = form.override_reason;
        (payload as UpdateShiftPayload).status = form.status;
      }

      await onSubmit(payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save shift');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialData ? "Edit Assignment / Override" : "Create Assignment"}
      icon={initialData ? <Edit3 size={20} /> : <Plus size={20} />}
    >
      <div className="flex bg-ink/5 dark:bg-paper/5 p-1 rounded-xl mb-4">
        <button
          type="button"
          onClick={() => !initialData && setMode('office')}
          disabled={!!initialData}
          className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
            mode === 'office' ? 'bg-paper text-ink shadow-sm' : 'text-muted hover:text-ink'
          } ${initialData ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Office Schedule
        </button>
        <button
          type="button"
          onClick={() => !initialData && setMode('rider')}
          disabled={!!initialData}
          className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
            mode === 'rider' ? 'bg-paper text-ink shadow-sm' : 'text-muted hover:text-ink'
          } ${initialData ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Rider Dispatch
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl text-xs text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}

        <div>
          <label className="font-medium text-xs text-muted block mb-1">
            {mode === 'office' ? 'Shift Title / Role' : 'Route / Dispatch Title'}
          </label>
          {mode === 'office' ? (
            <select
              required
              value={form.title || ''}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full bg-ink/[0.03] dark:bg-paper/[0.05] border border-line rounded-xl p-2.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
            >
              <option value="" disabled>Select Role...</option>
              {Array.from(new Set(drivers.filter(d => d.role && getEmployeeGroup(d.role) === 'Office').map(d => d.role))).map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              required
              placeholder="e.g. Mid-West Grain Transit"
              value={form.title || ''}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full bg-ink/[0.03] dark:bg-paper/[0.05] border border-line rounded-xl p-2.5 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
            />
          )}
        </div>

        <div>
          <label className="font-medium text-xs text-muted block mb-1">
            {mode === 'office' ? 'Assign Employee' : 'Assign Rider'}
          </label>
          <select
            value={form.driver_id ?? ''}
            onChange={(e) => {
              const selectedId = e.target.value || null;
              const updates: any = { driver_id: selectedId };
              if (selectedId && mode === 'office') {
                const driver = drivers.find(d => d.id === selectedId);
                if (driver?.role) {
                  updates.title = driver.role;
                }
              }
              setForm({ ...form, ...updates });
            }}
            className="w-full bg-ink/[0.03] dark:bg-paper/[0.05] border border-line rounded-xl p-2.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
          >
            <option value="">Unassigned</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.full_name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-medium text-xs text-muted block mb-1">Date</label>
            <input
              type="date"
              required
              value={form.shift_date || ''}
              onChange={(e) => setForm({ ...form, shift_date: e.target.value })}
              className="w-full bg-ink/[0.03] dark:bg-paper/[0.05] border border-line rounded-xl p-2.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
            />
          </div>
          {initialData && (
            <div>
              <label className="font-medium text-xs text-muted block mb-1">Force Status</label>
              <select
                value={form.status || 'Scheduled'}
                onChange={(e) => setForm({ ...form, status: e.target.value as ShiftStatus })}
                className="w-full bg-ink/[0.03] dark:bg-paper/[0.05] border border-line rounded-xl p-2.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
              >
                <option value="Scheduled">Scheduled</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Pending Driver">Pending Driver</option>
              </select>
            </div>
          )}
        </div>

        {mode === 'office' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-medium text-xs text-muted block mb-1">Time Block</label>
              <input
                type="text"
                required
                placeholder="08:00 AM - 05:00 PM"
                value={form.shift_time || ''}
                onChange={(e) => setForm({ ...form, shift_time: e.target.value })}
                className="w-full bg-ink/[0.03] dark:bg-paper/[0.05] border border-line rounded-xl p-2.5 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
              />
            </div>
            <div>
              <label className="font-medium text-xs text-muted block mb-1">Break Duration</label>
              <select
                value={form.break_duration_minutes ?? ''}
                onChange={(e) => setForm({ ...form, break_duration_minutes: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full bg-ink/[0.03] dark:bg-paper/[0.05] border border-line rounded-xl p-2.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
              >
                <option value="">No Break</option>
                <option value="15">15 mins</option>
                <option value="30">30 mins</option>
                <option value="45">45 mins</option>
                <option value="60">1 hour</option>
                <option value="90">1.5 hours</option>
              </select>
            </div>
          </div>
        )}

        {mode === 'rider' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-medium text-xs text-muted block mb-1">Expected Arrival</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 09:00 AM"
                  value={form.expected_arrival || ''}
                  onChange={(e) => setForm({ ...form, expected_arrival: e.target.value })}
                  className="w-full bg-ink/[0.03] dark:bg-paper/[0.05] border border-line rounded-xl p-2.5 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
                />
              </div>
              <div>
                <label className="font-medium text-xs text-muted block mb-1">Priority</label>
                <select
                  value={form.priority || 'Normal'}
                  onChange={(e) => setForm({ ...form, priority: e.target.value as 'Normal' | 'High' | 'Critical' })}
                  className="w-full bg-ink/[0.03] dark:bg-paper/[0.05] border border-line rounded-xl p-2.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
                >
                  {SHIFT_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="font-medium text-xs text-muted block mb-1">Vehicle Assignment</label>
              <input
                type="text"
                required
                value={form.vehicle || ''}
                onChange={(e) => setForm({ ...form, vehicle: e.target.value })}
                className="w-full bg-ink/[0.03] dark:bg-paper/[0.05] border border-line rounded-xl p-2.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
              />
            </div>
          </>
        )}

        {initialData && (
          <div>
            <label className="font-medium text-xs text-muted block mb-1">Reason for Override (Audit Log)</label>
            <input
              type="text"
              placeholder="e.g. Sick leave coverage, Vehicle breakdown"
              value={form.override_reason || ''}
              onChange={(e) => setForm({ ...form, override_reason: e.target.value })}
              className="w-full bg-ink/[0.03] dark:bg-paper/[0.05] border border-amber-500/30 rounded-xl p-2.5 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t border-line mt-4">
          <Button type="button" onClick={onClose} variant="ghost" disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'Saving...' : initialData ? 'Save Override' : 'Save Assignment'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
