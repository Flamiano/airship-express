import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Users, Truck, Clock } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CreateShiftModal } from '@/components/modals/CreateShiftModal';
import { useAuth } from '@/hooks/useAuth';
import { SHIFT_PRIORITY_BADGE } from '@/utils/constants';
import { canCreateShifts } from '@/utils/rbac';
import { apiFetch } from '@/lib/apiFetch';
import type { Shift } from '@/types/workforce';
import type { CreateShiftPayload } from '@/types/api';

export default function ShiftsPage() {
 const { role } = useAuth();
 const [shifts, setShifts] = useState<Shift[]>([]);
 const [drivers, setDrivers] = useState<Array<{ id: string; full_name: string }>>([]);
 const [modalOpen, setModalOpen] = useState(false);
 const [error, setError] = useState<string | null>(null);

 const load = useCallback(async () => {
 try {
 const data = await apiFetch<Shift[]>('/api/shifts');
 setShifts(data);
 } catch (err) {
 setError(err instanceof Error ? err.message : 'Failed to load shifts');
 }
 }, []);

 useEffect(() => {
 load();
 // Populate driver dropdown from /api/drivers.
 apiFetch<Array<{ id: string; full_name: string }>>('/api/drivers')
 .then(setDrivers)
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
 <DashboardLayout>
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-pink-100 shadow-sm">
 <div>
 <h1 className="text-xl font-bold text-pink-950">Shift & Schedule Management</h1>
 <p className="text-xs text-pink-600">
 Assign drivers to freight vehicles, manage route times, and handle coverage gaps.
 </p>
 </div>
 {canCreateShifts(role) && (
 <Button onClick={() => setModalOpen(true)} variant="primary">
 <Plus size={16} />
 Create Shift Assignment
 </Button>
 )}
 </div>

 {error && (
 <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-xs text-rose-800">
 {error}
 </div>
 )}

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {shifts.map((shift) => (
 <Card key={shift.id} className="p-5 space-y-3 hover:border-pink-300 transition">
 <div className="flex items-center justify-between">
 <span className="text-xs font-mono font-bold text-pink-500">
 {shift.id.slice(0, 8)}
 </span>
 <Badge className={SHIFT_PRIORITY_BADGE[shift.priority]}>
 {shift.priority} Priority
 </Badge>
 </div>

 <h3 className="font-bold text-pink-950 text-base">{shift.title}</h3>

 <div className="space-y-1.5 text-xs text-pink-800">
 <p className="flex items-center gap-2">
 <Users size={14} className="text-pink-500" />
 <span className="font-semibold">Driver:</span>{' '}
 {shift.driver?.full_name || 'Unassigned'}
 </p>
 <p className="flex items-center gap-2">
 <Truck size={14} className="text-pink-500" />
 <span className="font-semibold">Vehicle:</span> {shift.vehicle}
 </p>
 <p className="flex items-center gap-2">
 <Clock size={14} className="text-pink-500" />
 <span className="font-semibold">Time:</span> {shift.shift_date} • {shift.shift_time}
 </p>
 </div>

 <div className="pt-2 border-t border-pink-100 flex items-center justify-between">
 <span className="text-xs text-pink-600 font-semibold">Status: {shift.status}</span>
 </div>
 </Card>
 ))}
 {shifts.length === 0 && !error && (
 <p className="text-xs text-pink-400 col-span-full text-center py-8">
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
 </DashboardLayout>
 );
}
