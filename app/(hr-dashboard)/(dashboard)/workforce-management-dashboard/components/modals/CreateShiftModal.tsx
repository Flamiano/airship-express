import React, { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SHIFT_PRIORITIES } from '../../utils/constants';
import type { CreateShiftPayload } from '../../types/api';

interface CreateShiftModalProps {
 open: boolean;
 onClose: () => void;
 onSubmit: (payload: CreateShiftPayload) => Promise<void>;
 drivers: Array<{ id: string; full_name: string }>;
}

/**
 * Form modal for creating a new shift assignment. Called from the shifts page.
 * Submits to POST /api/shifts.
 */
export function CreateShiftModal({ open, onClose, onSubmit, drivers }: CreateShiftModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'office' | 'rider'>('office');
  const defaulted = useRef(false);

  const [form, setForm] = useState<CreateShiftPayload>({
    title: '',
    driver_id: drivers.length ? drivers[0].id : '',
    shift_date: new Date().toISOString().split('T')[0],
    shift_time: '08:00 - 17:00',
    vehicle: 'Freightliner Cascadia #902',
    expected_arrival: '09:00 AM',
    priority: 'Normal',
  });

  useEffect(() => {
    if (open && !defaulted.current) {
      defaulted.current = true;
      if (drivers.length && !form.driver_id) {
        setForm((f) => (f.driver_id ? f : { ...f, driver_id: drivers[0].id }));
      }
    } else if (!open) {
      defaulted.current = false;
    }
  }, [open, drivers, form.driver_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload: CreateShiftPayload = {
        title: form.title,
        driver_id: form.driver_id || null,
        shift_date: form.shift_date,
      };

      if (mode === 'office') {
        payload.shift_time = form.shift_time;
      } else {
        payload.vehicle = form.vehicle;
        payload.expected_arrival = form.expected_arrival;
        payload.priority = form.priority;
      }

      await onSubmit(payload);
      
      // Reset on success
      setForm({
        title: '',
        driver_id: drivers.length ? drivers[0].id : '',
        shift_date: new Date().toISOString().split('T')[0],
        shift_time: '08:00 - 17:00',
        vehicle: 'Freightliner Cascadia #902',
        expected_arrival: '09:00 AM',
        priority: 'Normal',
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create shift');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create Assignment"
      icon={<Plus size={20} />}
    >
      <div className="flex bg-ink/5 dark:bg-paper/5 p-1 rounded-xl mb-4">
        <button
          type="button"
          onClick={() => setMode('office')}
          className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
            mode === 'office' ? 'bg-paper text-ink shadow-sm' : 'text-muted hover:text-ink'
          }`}
        >
          Office Schedule
        </button>
        <button
          type="button"
          onClick={() => setMode('rider')}
          className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
            mode === 'rider' ? 'bg-paper text-ink shadow-sm' : 'text-muted hover:text-ink'
          }`}
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
          <input
            type="text"
            required
            placeholder={mode === 'office' ? "e.g. Morning HR Support" : "e.g. Mid-West Grain Transit"}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full bg-ink/[0.03] dark:bg-paper/[0.05] border border-line rounded-xl p-2.5 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
          />
        </div>

        <div>
          <label className="font-medium text-xs text-muted block mb-1">
            {mode === 'office' ? 'Assign Employee' : 'Assign Rider'}
          </label>
          <select
            value={form.driver_id ?? ''}
            onChange={(e) => setForm({ ...form, driver_id: e.target.value || null })}
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

        <div>
          <label className="font-medium text-xs text-muted block mb-1">Date</label>
          <input
            type="date"
            required
            value={form.shift_date}
            onChange={(e) => setForm({ ...form, shift_date: e.target.value })}
            className="w-full bg-ink/[0.03] dark:bg-paper/[0.05] border border-line rounded-xl p-2.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
          />
        </div>

        {mode === 'office' && (
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
        )}

        {mode === 'rider' && (
          <>
            <div>
              <label className="font-medium text-xs text-muted block mb-1">Expected Arrival Time</label>
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
              <label className="font-medium text-xs text-muted block mb-1">Vehicle Assignment</label>
              <input
                type="text"
                required
                value={form.vehicle || ''}
                onChange={(e) => setForm({ ...form, vehicle: e.target.value })}
                className="w-full bg-ink/[0.03] dark:bg-paper/[0.05] border border-line rounded-xl p-2.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
              />
            </div>
            <div>
              <label className="font-medium text-xs text-muted block mb-1">Dispatch Priority</label>
              <select
                value={form.priority || 'Normal'}
                onChange={(e) =>
                  setForm({
                    ...form,
                    priority: e.target.value as 'Normal' | 'High' | 'Critical',
                  })
                }
                className="w-full bg-ink/[0.03] dark:bg-paper/[0.05] border border-line rounded-xl p-2.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
              >
                {SHIFT_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t border-line mt-4">
          <Button type="button" onClick={onClose} variant="ghost" disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'Creating...' : 'Save Assignment'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
