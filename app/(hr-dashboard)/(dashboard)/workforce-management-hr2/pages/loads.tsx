import React, { useState, useEffect, useCallback } from 'react';
import { Plus, MapPin, ArrowRight, User, Info } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CreateLoadModal } from '@/components/modals/CreateLoadModal';
import { useAuth } from '@/hooks/useAuth';
import { LOAD_STATUS_BADGE, LOAD_STATUSES, SHIFT_PRIORITY_BADGE } from '@/utils/constants';
import { canManageLoads } from '@/utils/rbac';
import { apiFetch } from '@/lib/apiFetch';
import type { FreightLoad } from '@/types/workforce';
import type { CreateLoadPayload, UpdateLoadPayload } from '@/types/api';

interface DriverOption {
  id: string;
  full_name: string;
  on_shift?: boolean;
}

export default function LoadsPage() {
  const { role } = useAuth();
  const [loads, setLoads] = useState<FreightLoad[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/loads', {
        headers: { 'Content-Type': 'application/json' },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Failed to load loads');
      setLoads(body.data ?? []);
      setNotice(body.warning ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load loads');
    }
  }, []);

  useEffect(() => {
    load();
    // Driver dropdown: fleet drivers only, tagged with live On-Shift status.
    apiFetch<DriverOption[]>('/api/drivers')
      .then(setDrivers)
      .catch(() => setDrivers([]));
  }, [load]);

  const handleCreate = async (payload: CreateLoadPayload) => {
    await apiFetch<FreightLoad>('/api/loads', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await load();
  };

  const handlePatch = async (id: string, payload: UpdateLoadPayload) => {
    try {
      const updated = await apiFetch<FreightLoad>(`/api/loads/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setLoads((prev) => prev.map((l) => (l.id === id ? updated : l)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update load');
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-pink-100 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-pink-950">Freight Load Dispatch</h1>
          <p className="text-xs text-pink-600">
            Match available drivers to freight loads and track pickup status in real time.
          </p>
        </div>
        {canManageLoads(role) && (
          <Button onClick={() => setModalOpen(true)} variant="primary">
            <Plus size={16} />
            Create Freight Load
          </Button>
        )}
      </div>

      {notice && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-800">
          <Info size={14} className="mt-0.5 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-xs text-rose-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loads.map((load) => (
          <Card key={load.id} className="p-5 space-y-3 hover:border-pink-300 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-pink-500">
                {load.load_ref}
              </span>
              <div className="flex items-center gap-1.5">
                <Badge className={SHIFT_PRIORITY_BADGE[load.priority]}>
                  {load.priority} Priority
                </Badge>
                <Badge className={LOAD_STATUS_BADGE[load.status]}>{load.status}</Badge>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-pink-800 font-semibold">
              <span>{load.origin}</span>
              <ArrowRight size={14} className="text-pink-400" />
              <span>{load.destination}</span>
            </div>

            <div className="space-y-1.5 text-xs text-pink-800">
              <p className="flex items-center gap-2">
                <MapPin size={14} className="text-pink-500" />
                <span className="font-semibold">Pickup:</span> {load.pickup_date}
              </p>
              <p className="flex items-center gap-2">
                <User size={14} className="text-pink-500" />
                <span className="font-semibold">Assigned:</span>{' '}
                {load.driver?.full_name || 'Unassigned'}
              </p>
            </div>

            {canManageLoads(role) && (
              <div className="pt-2 border-t border-pink-100 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-pink-600 block mb-1">
                    Assign Driver
                  </label>
                  <select
                    value={load.driver_id ?? ''}
                    onChange={(e) =>
                      handlePatch(load.id, { driver_id: e.target.value || null })
                    }
                    className="w-full bg-pink-50 border border-pink-200 rounded-lg p-1.5 text-pink-950 text-[11px]"
                  >
                    <option value="">Unassigned</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.full_name}
                        {d.on_shift ? ' — On Shift' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-pink-600 block mb-1">
                    Status
                  </label>
                  <select
                    value={load.status}
                    onChange={(e) =>
                      handlePatch(load.id, {
                        status: e.target.value as FreightLoad['status'],
                      })
                    }
                    className="w-full bg-pink-50 border border-pink-200 rounded-lg p-1.5 text-pink-950 text-[11px]"
                  >
                    {LOAD_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </Card>
        ))}
        {loads.length === 0 && !error && (
          <p className="text-xs text-pink-400 col-span-full text-center py-8">
            No freight loads yet.
          </p>
        )}
      </div>

      <CreateLoadModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
      />
    </DashboardLayout>
  );
}
