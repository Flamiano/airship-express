import React, { useEffect, useRef, useState } from 'react';
import { Plus, Edit3, Search, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SHIFT_PRIORITIES } from '../../utils/constants';
import type { CreateShiftPayload, UpdateShiftPayload } from '../../types/api';
import { getEmployeeGroup, type Shift, type ShiftStatus } from '../../types/workforce';

interface CreateShiftModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateShiftPayload | UpdateShiftPayload) => Promise<void>;
  drivers: Array<{ id: string; full_name: string; role?: string; department?: string }>;
  initialData?: Shift | null;
}

export function CreateShiftModal({ open, onClose, onSubmit, drivers, initialData }: CreateShiftModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'office' | 'rider'>('office');
  const defaulted = useRef(false);

  // Search Filter State
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<{ type: 'department' | 'role', value: string } | null>(null);

  const [form, setForm] = useState<Partial<UpdateShiftPayload>>({
    title: '',
    driver_id: '',
    shift_date: new Date().toISOString().split('T')[0],
    shift_time: '08:00 AM - 05:00 PM',
    break_time: '12:00 PM - 01:00 PM',
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
          break_time: initialData.break_time || '',
          vehicle: initialData.vehicle || '',
          expected_arrival: initialData.expected_arrival || '',
          priority: initialData.priority || 'Normal',
          override_reason: initialData.override_reason || '',
          status: initialData.status || 'Scheduled',
        });
      } else if (!defaulted.current) {
        defaulted.current = true;
        setMode('office');
        setForm(f => ({ ...f, driver_id: '' }));
      }
    } else {
      defaulted.current = false;
      setIsSearching(false);
      setSearchQuery('');
      setActiveFilter(null);
    }
  }, [open, initialData]);

  // Derived state for filtering employees
  const modeFilteredDrivers = drivers.filter(d => {
    const group = getEmployeeGroup(d.role);
    if (mode === 'office') return group === 'Office';
    return group !== 'Office'; // Riders
  });

  const finalDrivers = modeFilteredDrivers.filter(d => {
    if (!activeFilter) return true;
    if (activeFilter.type === 'department') return d.department === activeFilter.value;
    if (activeFilter.type === 'role') return d.role === activeFilter.value;
    return true;
  });

  const selectedDriver = drivers.find(d => d.id === form.driver_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload: CreateShiftPayload | UpdateShiftPayload = {
        title: form.title || (mode === 'office' ? (selectedDriver?.role || 'Office Shift') : 'Rider Dispatch'),
        driver_id: form.driver_id || null,
        shift_date: form.shift_date!,
      };

      if (mode === 'office') {
        payload.shift_time = form.shift_time;
        payload.break_time = form.break_time;
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

  const renderModalTitle = () => {
    if (!isSearching && !activeFilter) {
      return (
        <div className="flex items-center gap-3 w-full group">
          <span>{initialData ? "Edit Assignment" : "Create Assignment"}</span>
          <button 
            type="button" 
            onClick={(e) => { e.stopPropagation(); setIsSearching(true); }}
            className="p-1.5 rounded hover:bg-ink/5 dark:hover:bg-paper/10 text-muted group-hover:text-ink transition-colors ml-auto mr-4 flex items-center gap-1.5 border border-transparent hover:border-line"
            title="Filter Employees"
          >
            <Search size={14} />
            <span className="text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity">Filter</span>
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 w-full pr-8 text-sm font-normal">
        {activeFilter ? (
          <div className="flex items-center gap-2 w-full">
            <div className="flex items-center bg-accent/10 text-accent px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-accent/20">
              <span className="uppercase text-[9px] tracking-wider opacity-70 mr-1.5">{activeFilter.type}</span>
              <select 
                value={activeFilter.value}
                onChange={(e) => setActiveFilter({ ...activeFilter, value: e.target.value })}
                className="bg-transparent border-none outline-none cursor-pointer text-accent font-bold"
              >
                {Array.from(new Set(modeFilteredDrivers.map(d => activeFilter.type === 'department' ? d.department : d.role).filter(Boolean))).map(val => (
                  <option key={val} value={val}>{val}</option>
                ))}
              </select>
            </div>
            <button type="button" onClick={() => setActiveFilter(null)} className="text-muted hover:text-ink p-1"><X size={14} /></button>
          </div>
        ) : (
          <div className="flex items-center gap-2 w-full relative">
            <Search size={14} className="text-muted absolute left-3" />
            <input 
              autoFocus
              type="text" 
              placeholder="Type 'department' or 'role'..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-ink/5 dark:bg-paper/5 border border-line rounded-lg py-1.5 pl-8 pr-8 text-xs focus:outline-none focus:border-accent transition-colors"
            />
            <button type="button" onClick={() => setIsSearching(false)} className="text-muted hover:text-ink absolute right-2"><X size={14} /></button>
            
            {searchQuery.length > 0 && (
              <div className="absolute top-full left-0 w-full mt-2 bg-paper border border-line rounded-xl shadow-xl overflow-hidden z-50 text-xs">
                {['department', 'role'].filter(f => f.includes(searchQuery.toLowerCase())).map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      const firstVal = modeFilteredDrivers.find(d => f === 'department' ? d.department : d.role);
                      const val = (f === 'department' ? firstVal?.department : firstVal?.role) || '';
                      setActiveFilter({ type: f as any, value: val });
                      setIsSearching(false);
                      setSearchQuery('');
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-ink/5 dark:hover:bg-white/5 border-b border-line last:border-0 transition-colors"
                  >
                    Filter by <span className="font-bold capitalize text-accent">{f}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={renderModalTitle()}
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

        {/* 1. Assign Employee (Moved to Top) */}
        <div className="bg-ink/[0.02] dark:bg-paper/[0.02] border border-line rounded-xl p-3">
          <label className="font-medium text-xs text-muted block mb-2">
            {mode === 'office' ? 'Assign Employee' : 'Assign Rider'}
          </label>
          <select
            value={form.driver_id ?? ''}
            onChange={(e) => {
              const selectedId = e.target.value || null;
              const updates: any = { driver_id: selectedId };
              if (selectedId && mode === 'office') {
                const driver = drivers.find(d => d.id === selectedId);
                if (driver?.role) updates.title = driver.role;
              }
              setForm({ ...form, ...updates });
            }}
            className="w-full bg-white dark:bg-paper border border-line rounded-lg p-2.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all shadow-sm"
          >
            <option value="">Unassigned</option>
            {finalDrivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.full_name} {d.role ? `(${d.role})` : ''}
              </option>
            ))}
          </select>

          {selectedDriver && (
            <div className="mt-3 flex items-center justify-between text-[11px] bg-white/50 dark:bg-black/20 p-2.5 rounded-lg border border-line/50">
              <div className="flex flex-col">
                <span className="text-muted/70 uppercase font-semibold tracking-wider">Department</span>
                <span className="font-medium text-ink mt-0.5">{selectedDriver.department || 'N/A'}</span>
              </div>
              <div className="h-6 w-px bg-line/50" />
              <div className="flex flex-col text-right">
                <span className="text-muted/70 uppercase font-semibold tracking-wider">Role</span>
                <span className="font-medium text-ink mt-0.5">{selectedDriver.role || 'N/A'}</span>
              </div>
            </div>
          )}
        </div>

        {/* 2. Shift Title / Role (Moved to Bottom) */}
        {mode === 'office' ? (
          !form.driver_id && (
            <div>
              <label className="font-medium text-xs text-muted block mb-1">Role Needed (For Unassigned Shift)</label>
              <select
                required
                value={form.title || ''}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full bg-ink/[0.03] dark:bg-paper/[0.05] border border-line rounded-xl p-2.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
              >
                <option value="" disabled>Select Role...</option>
                {Array.from(new Set(modeFilteredDrivers.map(d => d.role).filter(Boolean))).map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
          )
        ) : (
          <div>
            <label className="font-medium text-xs text-muted block mb-1">Route / Dispatch Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Mid-West Grain Transit"
              value={form.title || ''}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full bg-ink/[0.03] dark:bg-paper/[0.05] border border-line rounded-xl p-2.5 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
            />
          </div>
        )}

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
              <label className="font-medium text-xs text-muted block mb-1">Break Time Block</label>
              <input
                type="text"
                placeholder="e.g. 12:00 PM - 01:00 PM"
                value={form.break_time || ''}
                onChange={(e) => setForm({ ...form, break_time: e.target.value })}
                className="w-full bg-ink/[0.03] dark:bg-paper/[0.05] border border-line rounded-xl p-2.5 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
              />
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
