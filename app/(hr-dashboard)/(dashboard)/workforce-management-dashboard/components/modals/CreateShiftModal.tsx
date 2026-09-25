import React, { useEffect, useRef, useState } from 'react';
import { Plus, Edit3, Search, X, ChevronUp, ChevronDown, Clock } from 'lucide-react';
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

type TimeObj = { h: string; m: string; p: string };
type PickerMode = 'shift_start' | 'shift_end' | 'break_start' | 'break_end' | null;

const formatTime = (t: TimeObj) => `${t.h}:${t.m} ${t.p}`;
const formatTimeBlock = (s: TimeObj, e: TimeObj) => `${formatTime(s)} - ${formatTime(e)}`;

const parseTimeStr = (t: string): TimeObj => {
  try {
    const [hm, p] = t.trim().split(' ');
    const [h, m] = hm.split(':');
    return { h: h.padStart(2, '0'), m: m.padStart(2, '0'), p: p.toUpperCase() };
  } catch {
    return { h: '12', m: '00', p: 'AM' };
  }
};

const parseTimeBlock = (str: string) => {
  const [start, end] = str.split('-');
  if (start && end) {
    return { s: parseTimeStr(start), e: parseTimeStr(end) };
  }
  return null;
};

export function CreateShiftModal({ open, onClose, onSubmit, drivers, initialData }: CreateShiftModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'office' | 'rider'>('office');
  const defaulted = useRef(false);

  // Search Filter State
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<{ type: 'department' | 'role', value: string } | null>(null);

  // Core Form State
  const [driverId, setDriverId] = useState<string>('');
  const [shiftTitle, setShiftTitle] = useState<string>('');
  const [status, setStatus] = useState<ShiftStatus>('Scheduled');
  const [overrideReason, setOverrideReason] = useState('');

  // Date State
  const [dateMode, setDateMode] = useState<'single' | 'range' | 'recurring'>('single');
  const [singleDate, setSingleDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [recurringDays, setRecurringDays] = useState<number[]>([]); 

  // Time State
  const [startTime, setStartTime] = useState<TimeObj>({ h: '08', m: '00', p: 'AM' });
  const [endTime, setEndTime] = useState<TimeObj>({ h: '05', m: '00', p: 'PM' });
  
  const [hasBreak, setHasBreak] = useState(true);
  const [breakStartTime, setBreakStartTime] = useState<TimeObj>({ h: '12', m: '00', p: 'PM' });
  const [breakEndTime, setBreakEndTime] = useState<TimeObj>({ h: '01', m: '00', p: 'PM' });

  // Time Picker Panel State
  const [activePicker, setActivePicker] = useState<PickerMode>(null);
  const [tempTime, setTempTime] = useState<TimeObj>({ h: '12', m: '00', p: 'AM' });

  useEffect(() => {
    if (open) {
      if (initialData) {
        const isOffice = getEmployeeGroup(initialData.employee?.role) === 'Office';
        setMode(isOffice ? 'office' : 'rider');
        setDriverId(initialData.employee_id || '');
        setShiftTitle(initialData.title || '');
        setSingleDate(initialData.shift_date || '');
        setDateMode('single');
        setStatus(initialData.status || 'Scheduled');
        setOverrideReason(initialData.override_reason || '');

        if (initialData.shift_time) {
          const parsed = parseTimeBlock(initialData.shift_time);
          if (parsed) {
            setStartTime(parsed.s);
            setEndTime(parsed.e);
          }
        }
        if (initialData.break_time) {
          setHasBreak(true);
          const parsed = parseTimeBlock(initialData.break_time);
          if (parsed) {
            setBreakStartTime(parsed.s);
            setBreakEndTime(parsed.e);
          }
        } else {
          setHasBreak(false);
        }

      } else if (!defaulted.current) {
        defaulted.current = true;
        setMode('office');
        setDriverId('');
        setShiftTitle('');
        setDateMode('single');
        setSingleDate(new Date().toISOString().split('T')[0]);
        setStartDate(new Date().toISOString().split('T')[0]);
        setEndDate('');
        setRecurringDays([]);
      }
    } else {
      defaulted.current = false;
      setIsSearching(false);
      setSearchQuery('');
      setActiveFilter(null);
      setActivePicker(null);
    }
  }, [open, initialData]);

  // Filtering
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

  const selectedDriver = drivers.find(d => d.id === driverId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let datesToCreate: string[] = [];
      if (initialData || dateMode === 'single') {
        if (!singleDate) throw new Error("Please select a date.");
        datesToCreate = [singleDate];
      } else if (dateMode === 'range') {
        if (!startDate || !endDate) throw new Error("Please select both start and end dates.");
        let curr = new Date(startDate);
        const end = new Date(endDate);
        if (curr > end) throw new Error("Start date must be before end date.");
        
        while (curr <= end) {
          datesToCreate.push(curr.toISOString().split('T')[0]);
          curr.setDate(curr.getDate() + 1);
        }
      } else if (dateMode === 'recurring') {
        if (!singleDate) throw new Error("Please select a start date.");
        if (recurringDays.length === 0) throw new Error("Please select at least one day for the recurring schedule.");
        
        let curr = new Date(singleDate);
        const end = new Date(curr);
        end.setDate(end.getDate() + 28); // 4 weeks range
        
        while (curr <= end) {
          if (recurringDays.includes(curr.getDay())) {
            datesToCreate.push(curr.toISOString().split('T')[0]);
          }
          curr.setDate(curr.getDate() + 1);
        }
      }

      if (datesToCreate.length === 0) throw new Error("No dates match your selection.");

      const basePayload: Partial<CreateShiftPayload> = {
        title: shiftTitle || (mode === 'office' ? (selectedDriver?.role || 'Office Shift') : 'Rider Dispatch'),
        driver_id: driverId || null,
      };

      if (mode === 'office') {
        const parseTimeObjToDate = (t: TimeObj) => {
          const d = new Date();
          let h = parseInt(t.h);
          if (t.p === 'PM' && h < 12) h += 12;
          if (t.p === 'AM' && h === 12) h = 0;
          d.setHours(h, parseInt(t.m), 0, 0);
          return d;
        };

        const sStart = parseTimeObjToDate(startTime);
        let sEnd = parseTimeObjToDate(endTime);
        const isOvernight = sStart > sEnd;
        if (isOvernight) sEnd.setDate(sEnd.getDate() + 1);

        if (sStart.getTime() === sEnd.getTime()) throw new Error("Shift start and end time cannot be exactly the same.");

        if (hasBreak) {
          let bStart = parseTimeObjToDate(breakStartTime);
          let bEnd = parseTimeObjToDate(breakEndTime);

          // Adjust overnight breaks
          if (isOvernight) {
             if (bStart < sStart) bStart.setDate(bStart.getDate() + 1);
             if (bEnd < sStart) bEnd.setDate(bEnd.getDate() + 1);
          }
          if (bStart > bEnd) bEnd.setDate(bEnd.getDate() + 1); // Break crosses midnight

          if (bStart.getTime() === bEnd.getTime()) throw new Error("Break start and end time cannot be exactly the same.");
          if (bStart < sStart || bEnd > sEnd) throw new Error("Break time must be strictly within the shift time block.");
        basePayload.shift_time = formatTimeBlock(startTime, endTime);
        basePayload.break_time = hasBreak ? formatTimeBlock(breakStartTime, breakEndTime) : undefined;
      }
      
      if (initialData) {
        const payload: UpdateShiftPayload = {
          ...(basePayload as CreateShiftPayload),
          id: initialData.id,
          shift_date: datesToCreate[0],
          override_reason: overrideReason,
          status: status,
        };
        await onSubmit(payload);
      } else {
        for (const date of datesToCreate) {
          const payload: CreateShiftPayload = {
            ...(basePayload as CreateShiftPayload),
            shift_date: date,
          };
          await onSubmit(payload);
        }
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save shift');
    } finally {
      setLoading(false);
    }
  };

  const openPicker = (picker: PickerMode, currentVal: TimeObj) => {
    setTempTime(currentVal);
    setActivePicker(picker);
  };

  const closePicker = () => setActivePicker(null);

  const applyPicker = () => {
    if (activePicker === 'shift_start') setStartTime(tempTime);
    else if (activePicker === 'shift_end') setEndTime(tempTime);
    else if (activePicker === 'break_start') setBreakStartTime(tempTime);
    else if (activePicker === 'break_end') setBreakEndTime(tempTime);
    closePicker();
  };

  const incH = () => setTempTime(t => ({ ...t, h: String((parseInt(t.h) % 12) + 1).padStart(2, '0') }));
  const decH = () => setTempTime(t => ({ ...t, h: String(parseInt(t.h) === 1 ? 12 : parseInt(t.h) - 1).padStart(2, '0') }));
  const incM = () => setTempTime(t => ({ ...t, m: String((parseInt(t.m) + 5) % 60).padStart(2, '0') }));
  const decM = () => setTempTime(t => ({ ...t, m: String(parseInt(t.m) === 0 ? 55 : parseInt(t.m) - 5).padStart(2, '0') }));
  const toggleP = () => setTempTime(t => ({ ...t, p: t.p === 'AM' ? 'PM' : 'AM' }));

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

  const getPickerLabel = () => {
    switch(activePicker) {
      case 'shift_start': return 'Set Shift Start';
      case 'shift_end': return 'Set Shift End';
      case 'break_start': return 'Set Break Start';
      case 'break_end': return 'Set Break End';
      default: return 'Set Time';
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={renderModalTitle()}
      icon={initialData ? <Edit3 size={20} /> : <Plus size={20} />}
      maxWidth={activePicker ? 'max-w-[792px]' : 'max-w-md'}
    >
      <div className="flex">
        {/* Main Form Left Side */}
        <div className="w-[400px] flex-shrink-0 transition-all duration-300">
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

            {/* 1. Assign Employee */}
            <div className="bg-ink/[0.02] dark:bg-paper/[0.02] border border-line rounded-xl p-3">
              <label className="font-medium text-xs text-muted block mb-2">
                {mode === 'office' ? 'Assign Employee' : 'Assign Rider'}
              </label>
              <select
                value={driverId}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  setDriverId(selectedId);
                  if (selectedId && mode === 'office') {
                    const driver = drivers.find(d => d.id === selectedId);
                    if (driver?.role) setShiftTitle(driver.role);
                  }
                }}
                className="w-full bg-white dark:bg-paper border border-line rounded-lg p-2.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all shadow-sm"
              >
                <option value="" className="bg-white dark:bg-paper text-ink">Unassigned</option>
                {finalDrivers.map((d) => (
                  <option key={d.id} value={d.id} className="bg-white dark:bg-paper text-ink">
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

            {/* 2. Shift Title / Role */}
            {mode === 'office' ? (
              !driverId && (
                <div>
                  <label className="font-medium text-xs text-muted block mb-1">Role Needed (For Unassigned Shift)</label>
                  <select
                    required
                    value={shiftTitle}
                    onChange={(e) => setShiftTitle(e.target.value)}
                    className="w-full bg-ink/[0.03] dark:bg-paper/[0.05] border border-line rounded-xl p-2.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
                  >
                    <option value="" disabled>Select Role...</option>
                    {Array.from(new Set(modeFilteredDrivers.map(d => d.role).filter(Boolean))).map(role => (
                      <option key={role} value={role} className="bg-white dark:bg-paper text-ink">{role}</option>
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
                  value={shiftTitle}
                  onChange={(e) => setShiftTitle(e.target.value)}
                  className="w-full bg-ink/[0.03] dark:bg-paper/[0.05] border border-line rounded-xl p-2.5 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
                />
              </div>
            )}

            {/* 3. Date Selection */}
            <div className="bg-ink/[0.02] dark:bg-paper/[0.02] border border-line rounded-xl p-3">
              <div className="flex items-center justify-between mb-3">
                <label className="font-medium text-xs text-muted block">Date(s)</label>
                {!initialData && (
                  <div className="flex gap-1 bg-ink/5 dark:bg-paper/10 p-0.5 rounded-md">
                    {['single', 'range', 'recurring'].map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setDateMode(m as any)}
                        className={`px-2 py-1 text-[10px] rounded font-medium capitalize transition-colors ${dateMode === m ? 'bg-paper dark:bg-black text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {dateMode === 'single' || initialData ? (
                <input 
                  type="date" 
                  required
                  value={singleDate} 
                  onChange={e => setSingleDate(e.target.value)} 
                  className="w-full bg-white dark:bg-paper border border-line rounded-lg p-2.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all shadow-sm"
                />
              ) : dateMode === 'range' ? (
                <div className="flex items-center gap-2">
                  <input 
                    type="date" 
                    required
                    value={startDate} 
                    onChange={e => setStartDate(e.target.value)} 
                    className="w-full bg-white dark:bg-paper border border-line rounded-lg p-2.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all shadow-sm"
                  />
                  <span className="text-muted text-[10px] uppercase font-bold">to</span>
                  <input 
                    type="date" 
                    required
                    value={endDate} 
                    onChange={e => setEndDate(e.target.value)} 
                    className="w-full bg-white dark:bg-paper border border-line rounded-lg p-2.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all shadow-sm"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-muted text-[10px] uppercase font-semibold">Start generating 4 weeks from:</p>
                  <input 
                    type="date" 
                    required
                    value={singleDate} 
                    onChange={e => setSingleDate(e.target.value)} 
                    className="w-full bg-white dark:bg-paper border border-line rounded-lg p-2.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all shadow-sm"
                  />
                  <div className="flex items-center justify-between pt-2">
                    {['Su', 'M', 'Tu', 'We', 'Th', 'F', 'Sa'].map((day, i) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setRecurringDays(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i].sort())}
                        className={`h-8 w-8 rounded-full text-[10px] font-bold border transition-colors ${recurringDays.includes(i) ? 'bg-accent text-white border-accent' : 'bg-transparent border-line text-muted hover:border-accent/50 hover:text-ink'}`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {mode === 'office' && (
              <div className="bg-ink/[0.02] dark:bg-paper/[0.02] border border-line rounded-xl p-3 space-y-4">
                {/* Time Block */}
                <div>
                  <label className="font-medium text-xs text-muted block mb-2">Shift Time</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openPicker('shift_start', startTime)}
                      className={`flex-1 flex items-center justify-center gap-2 bg-white dark:bg-paper border rounded-lg p-2.5 text-xs font-mono transition-colors ${activePicker === 'shift_start' ? 'border-accent text-accent shadow-sm' : 'border-line text-ink hover:border-accent/50'}`}
                    >
                      <Clock size={14} /> {formatTime(startTime)}
                    </button>
                    <span className="text-muted text-[10px] uppercase font-bold">to</span>
                    <button
                      type="button"
                      onClick={() => openPicker('shift_end', endTime)}
                      className={`flex-1 flex items-center justify-center gap-2 bg-white dark:bg-paper border rounded-lg p-2.5 text-xs font-mono transition-colors ${activePicker === 'shift_end' ? 'border-accent text-accent shadow-sm' : 'border-line text-ink hover:border-accent/50'}`}
                    >
                      <Clock size={14} /> {formatTime(endTime)}
                    </button>
                  </div>
                </div>

                {/* Break Time */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-medium text-xs text-muted block">Break Time</label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={!hasBreak}
                        onChange={(e) => setHasBreak(!e.target.checked)}
                        className="rounded border-line text-accent focus:ring-accent/30" 
                      />
                      <span className="text-[10px] text-muted font-medium uppercase tracking-wider">No Break</span>
                    </label>
                  </div>
                  {hasBreak && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openPicker('break_start', breakStartTime)}
                        className={`flex-1 flex items-center justify-center gap-2 bg-white dark:bg-paper border rounded-lg p-2.5 text-xs font-mono transition-colors ${activePicker === 'break_start' ? 'border-amber-500 text-amber-600 shadow-sm' : 'border-line text-ink hover:border-amber-500/50'}`}
                      >
                        <Clock size={14} /> {formatTime(breakStartTime)}
                      </button>
                      <span className="text-muted text-[10px] uppercase font-bold">to</span>
                      <button
                        type="button"
                        onClick={() => openPicker('break_end', breakEndTime)}
                        className={`flex-1 flex items-center justify-center gap-2 bg-white dark:bg-paper border rounded-lg p-2.5 text-xs font-mono transition-colors ${activePicker === 'break_end' ? 'border-amber-500 text-amber-600 shadow-sm' : 'border-line text-ink hover:border-amber-500/50'}`}
                      >
                        <Clock size={14} /> {formatTime(breakEndTime)}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {mode === 'rider' && (
              <div className="bg-ink/[0.02] dark:bg-paper/[0.02] border border-line rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3 text-accent">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                  <h3 className="font-semibold text-[10px] uppercase tracking-wider">Live Fleet Integration</h3>
                </div>
                
                {initialData ? (
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-muted mb-1">Vehicle Assignment</p>
                      <p className="font-medium text-ink">{initialData.fleet_data?.vehicle || 'Pending'}</p>
                    </div>
                    <div>
                      <p className="text-muted mb-1">Expected Arrival</p>
                      <p className="font-medium text-ink">{initialData.fleet_data?.expected_arrival || 'Pending'}</p>
                    </div>
                    <div>
                      <p className="text-muted mb-1">Priority</p>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-bold">{initialData.fleet_data?.priority || 'Normal'}</span>
                    </div>
                    <div>
                      <p className="text-muted mb-1">Dispatch Status</p>
                      <p className="font-medium text-emerald-500">Linked to Fleet DB</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 bg-white/50 dark:bg-black/20 rounded-lg border border-line/50">
                    <p className="text-muted text-[10px] italic">Once this schedule is assigned, the Fleet Department will assign a vehicle and route via their system.</p>
                  </div>
                )}
              </div>
            )}

            {initialData && (
              <div>
                <label className="font-medium text-xs text-muted block mb-1">Reason for Override (Audit Log)</label>
                <input
                  type="text"
                  placeholder="e.g. Sick leave coverage, Vehicle breakdown"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full bg-ink/[0.03] dark:bg-paper/[0.05] border border-amber-500/30 rounded-xl p-2.5 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t border-line mt-4">
              <Button type="button" onClick={onClose} variant="ghost" disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={loading}>
                {loading ? 'Saving...' : initialData ? 'Save Override' : 'Save Assignment(s)'}
              </Button>
            </div>
          </form>
        </div>

        {/* Side Panel: Time Picker Alarm Clock UI */}
        <div 
          className={`overflow-hidden transition-all duration-300 ease-in-out flex flex-col justify-center ${
            activePicker ? 'w-[320px] ml-6 opacity-100' : 'w-0 opacity-0 ml-0'
          }`}
        >
          {activePicker && (
            <div className="bg-paper border border-line rounded-2xl shadow-sm p-6 w-[320px] flex-shrink-0 animate-in slide-in-from-right-8 duration-300">
              <h4 className="text-sm font-semibold text-ink mb-6 flex items-center gap-2">
                <Clock size={16} className={activePicker.includes('break') ? 'text-amber-500' : 'text-accent'} /> 
                {getPickerLabel()}
              </h4>
              
              <div className="flex items-center justify-center gap-4 text-4xl font-bold font-mono bg-ink/5 dark:bg-black/20 py-8 px-4 rounded-2xl border border-line mb-8">
                {/* Hours */}
                <div className="flex flex-col items-center">
                   <button type="button" onClick={incH} className="text-muted hover:text-ink pb-2 transition-colors"><ChevronUp size={32}/></button>
                   <span className="text-ink">{tempTime.h}</span>
                   <button type="button" onClick={decH} className="text-muted hover:text-ink pt-2 transition-colors"><ChevronDown size={32}/></button>
                </div>
                
                <span className="text-muted/50 pb-1">:</span>
                
                {/* Minutes */}
                <div className="flex flex-col items-center">
                   <button type="button" onClick={incM} className="text-muted hover:text-ink pb-2 transition-colors"><ChevronUp size={32}/></button>
                   <span className="text-ink">{tempTime.m}</span>
                   <button type="button" onClick={decM} className="text-muted hover:text-ink pt-2 transition-colors"><ChevronDown size={32}/></button>
                </div>
                
                {/* AM/PM */}
                <div className="flex flex-col items-center ml-2 text-2xl">
                   <button type="button" onClick={toggleP} className="text-muted hover:text-ink pb-2 transition-colors"><ChevronUp size={24}/></button>
                   <span className={activePicker.includes('break') || activePicker.includes('expected') ? 'text-amber-500' : 'text-accent'}>{tempTime.p}</span>
                   <button type="button" onClick={toggleP} className="text-muted hover:text-ink pt-2 transition-colors"><ChevronDown size={24}/></button>
                </div>
              </div>
              
              <div className="flex gap-3 w-full">
                <Button type="button" onClick={closePicker} variant="ghost" className="flex-1 border border-line text-xs py-2 h-auto">Cancel</Button>
                <Button type="button" onClick={applyPicker} variant="primary" className="flex-1 text-xs py-2 h-auto">Set Time</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
