import React, { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { SHIFT_PRIORITIES } from '@/utils/constants';
import type { CreateShiftPayload } from '@/types/api';

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
 const defaulted = useRef(false);

 const [form, setForm] = useState<CreateShiftPayload>({
 title: '',
 driver_id: drivers.length ? drivers[0].id : '',
 vehicle: 'Freightliner Cascadia #902',
 shift_date: new Date().toISOString().split('T')[0],
 shift_time: '08:00 - 16:00',
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
 await onSubmit({ ...form, driver_id: form.driver_id || null });
 // Reset on success
 setForm({
 title: '',
 driver_id: drivers.length ? drivers[0].id : '',
 vehicle: 'Freightliner Cascadia #902',
 shift_date: new Date().toISOString().split('T')[0],
 shift_time: '08:00 - 16:00',
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
 title="Create Shift Assignment"
 icon={<Plus size={20} />}
 >
 <form onSubmit={handleSubmit} className="space-y-3 text-xs">
 {error && (
 <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg text-xs text-rose-800">
 {error}
 </div>
 )}

 <div>
 <label className="font-bold text-pink-900 block mb-1">Route / Shift Title</label>
 <input
 type="text"
 required
 placeholder="e.g. Mid-West Grain Transit"
 value={form.title}
 onChange={(e) => setForm({ ...form, title: e.target.value })}
 className="w-full bg-pink-50 border border-pink-200 rounded-xl p-2 text-pink-950 focus:outline-none focus:ring-2 focus:ring-pink-400"
 />
 </div>

 <div>
 <label className="font-bold text-pink-900 block mb-1">Assign Driver</label>
 <select
 value={form.driver_id ?? ''}
 onChange={(e) => setForm({ ...form, driver_id: e.target.value || null })}
 className="w-full bg-pink-50 border border-pink-200 rounded-xl p-2 text-pink-950"
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
 <label className="font-bold text-pink-900 block mb-1">Vehicle Assignment</label>
 <input
 type="text"
 required
 value={form.vehicle}
 onChange={(e) => setForm({ ...form, vehicle: e.target.value })}
 className="w-full bg-pink-50 border border-pink-200 rounded-xl p-2 text-pink-950"
 />
 </div>

 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="font-bold text-pink-900 block mb-1">Date</label>
 <input
 type="date"
 required
 value={form.shift_date}
 onChange={(e) => setForm({ ...form, shift_date: e.target.value })}
 className="w-full bg-pink-50 border border-pink-200 rounded-xl p-2 text-pink-950"
 />
 </div>
 <div>
 <label className="font-bold text-pink-900 block mb-1">Time</label>
 <input
 type="text"
 required
 placeholder="08:00 - 16:00"
 value={form.shift_time}
 onChange={(e) => setForm({ ...form, shift_time: e.target.value })}
 className="w-full bg-pink-50 border border-pink-200 rounded-xl p-2 text-pink-950"
 />
 </div>
 </div>

 <div>
 <label className="font-bold text-pink-900 block mb-1">Priority</label>
 <select
 value={form.priority}
 onChange={(e) =>
 setForm({
 ...form,
 priority: e.target.value as 'Normal' | 'High' | 'Critical',
 })
 }
 className="w-full bg-pink-50 border border-pink-200 rounded-xl p-2 text-pink-950"
 >
 {SHIFT_PRIORITIES.map((p) => (
 <option key={p} value={p}>
 {p}
 </option>
 ))}
 </select>
 </div>

 <div className="flex justify-end gap-2 pt-3 border-t border-pink-100">
 <Button type="button" onClick={onClose} variant="ghost" disabled={loading}>
 Cancel
 </Button>
 <Button type="submit" variant="primary" disabled={loading}>
 {loading ? 'Creating...' : 'Save Shift'}
 </Button>
 </div>
 </form>
 </Modal>
 );
}
