import React, { useState } from 'react';
import { Package } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SHIFT_PRIORITIES } from '../../utils/constants';
import type { CreateLoadPayload } from '../../types/api';

interface CreateLoadModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateLoadPayload) => Promise<void>;
}

/**
 * Form modal for creating a new freight load. Called from the loads page.
 * Submits to POST /api/loads.
 */
export function CreateLoadModal({ open, onClose, onSubmit }: CreateLoadModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<CreateLoadPayload>({
    load_ref: '',
    origin: '',
    destination: '',
    pickup_date: new Date().toISOString().split('T')[0],
    priority: 'Normal',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSubmit(form);
      setForm({
        load_ref: '',
        origin: '',
        destination: '',
        pickup_date: new Date().toISOString().split('T')[0],
        priority: 'Normal',
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create load');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create Freight Load"
      icon={<Package size={20} />}
    >
      <form onSubmit={handleSubmit} className="space-y-3 text-xs">
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl text-xs text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}

        <div>
          <label className="font-medium text-xs text-muted block mb-1">Load Reference</label>
          <input
            type="text"
            required
            placeholder="e.g. FL-7742"
            value={form.load_ref}
            onChange={(e) => setForm({ ...form, load_ref: e.target.value })}
            className="w-full bg-ink/[0.03] dark:bg-paper/[0.05] border border-line rounded-xl p-2.5 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-medium text-xs text-muted block mb-1">Origin</label>
            <input
              type="text"
              required
              placeholder="e.g. North Hub Chicago"
              value={form.origin}
              onChange={(e) => setForm({ ...form, origin: e.target.value })}
              className="w-full bg-ink/[0.03] dark:bg-paper/[0.05] border border-line rounded-xl p-2.5 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
            />
          </div>
          <div>
            <label className="font-medium text-xs text-muted block mb-1">Destination</label>
            <input
              type="text"
              required
              placeholder="e.g. Central Port Freight"
              value={form.destination}
              onChange={(e) => setForm({ ...form, destination: e.target.value })}
              className="w-full bg-ink/[0.03] dark:bg-paper/[0.05] border border-line rounded-xl p-2.5 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-medium text-xs text-muted block mb-1">Pickup Date</label>
            <input
              type="date"
              required
              value={form.pickup_date}
              onChange={(e) => setForm({ ...form, pickup_date: e.target.value })}
              className="w-full bg-ink/[0.03] dark:bg-paper/[0.05] border border-line rounded-xl p-2.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
            />
          </div>
          <div>
            <label className="font-medium text-xs text-muted block mb-1">Priority</label>
            <select
              value={form.priority}
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
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-line">
          <Button type="button" onClick={onClose} variant="ghost" disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'Creating...' : 'Save Load'}
          </Button>
        </div>

      </form>
    </Modal>
  );
}
