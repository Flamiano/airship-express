import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { LEAVE_TYPES } from '@/utils/constants';
import type { CreateLeavePayload } from '@/types/api';

interface LeaveRequestModalProps {
 open: boolean;
 onClose: () => void;
 onSubmit: (payload: CreateLeavePayload) => Promise<void>;
}

/**
 * Form modal for submitting a leave request. Employees request leave for
 * themselves; HR Admin then approves/rejects. Submits to POST /api/leave.
 */
export function LeaveRequestModal({ open, onClose, onSubmit }: LeaveRequestModalProps) {
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);

 const [form, setForm] = useState<CreateLeavePayload>({
 leave_type: 'Paid Time Off (PTO)',
 start_date: new Date().toISOString().split('T')[0],
 end_date: new Date().toISOString().split('T')[0],
 reason: '',
 });

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setLoading(true);
 setError(null);
 try {
 await onSubmit(form);
 // Reset on success
 setForm({
 leave_type: 'Paid Time Off (PTO)',
 start_date: new Date().toISOString().split('T')[0],
 end_date: new Date().toISOString().split('T')[0],
 reason: '',
 });
 onClose();
 } catch (err) {
 setError(err instanceof Error ? err.message : 'Failed to request leave');
 } finally {
 setLoading(false);
 }
 };

 return (
 <Modal
 open={open}
 onClose={onClose}
 title="Request Leave / Fatigue Rest"
 icon={<Plus size={20} />}
 >
 <form onSubmit={handleSubmit} className="space-y-3 text-xs">
 {error && (
 <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg text-xs text-rose-800">
 {error}
 </div>
 )}

 <div>
 <label className="font-bold text-pink-900 block mb-1">Leave Type</label>
 <select
 value={form.leave_type}
 onChange={(e) =>
 setForm({
 ...form,
 leave_type: e.target.value as typeof form.leave_type,
 })
 }
 className="w-full bg-pink-50 border border-pink-200 rounded-xl p-2 text-pink-950"
 >
 {LEAVE_TYPES.map((type) => (
 <option key={type} value={type}>
 {type}
 </option>
 ))}
 </select>
 </div>

 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="font-bold text-pink-900 block mb-1">Start Date</label>
 <input
 type="date"
 required
 value={form.start_date}
 onChange={(e) => setForm({ ...form, start_date: e.target.value })}
 className="w-full bg-pink-50 border border-pink-200 rounded-xl p-2 text-pink-950"
 />
 </div>
 <div>
 <label className="font-bold text-pink-900 block mb-1">End Date</label>
 <input
 type="date"
 required
 value={form.end_date}
 onChange={(e) => setForm({ ...form, end_date: e.target.value })}
 className="w-full bg-pink-50 border border-pink-200 rounded-xl p-2 text-pink-950"
 />
 </div>
 </div>

 <div>
 <label className="font-bold text-pink-900 block mb-1">Reason (optional)</label>
 <textarea
 value={form.reason}
 onChange={(e) => setForm({ ...form, reason: e.target.value })}
 rows={3}
 placeholder="Optional details for the HR Admin..."
 className="w-full bg-pink-50 border border-pink-200 rounded-xl p-2 text-pink-950 focus:outline-none focus:ring-2 focus:ring-pink-400 resize-none"
 />
 </div>

 <div className="flex justify-end gap-2 pt-3 border-t border-pink-100">
 <Button type="button" onClick={onClose} variant="ghost" disabled={loading}>
 Cancel
 </Button>
 <Button type="submit" variant="primary" disabled={loading}>
 {loading ? 'Submitting...' : 'Submit Request'}
 </Button>
 </div>
 </form>
 </Modal>
 );
}
