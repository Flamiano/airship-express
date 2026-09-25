import React from 'react';
import { getEmployeeGroup, type Shift } from '../../types/workforce';

interface Props {
  shifts: Shift[];
  onShiftClick?: (shift: Shift) => void;
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 6); // 6 AM to 7 PM (19:00)

export const SprintChart: React.FC<Props> = ({ shifts, onShiftClick }) => {
  // Group by Department
  const grouped = shifts.reduce((acc, shift) => {
    const dept = shift.employee?.department || 'Unassigned';
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(shift);
    return acc;
  }, {} as Record<string, Shift[]>);

  // Helper to parse time string like "08:00 AM - 05:00 PM" or "07:30 AM" to cell indices
  const getPositionForTime = (timeStr?: string | null) => {
    if (!timeStr) return -1;
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return -1;
    let [ , h, m, ampm ] = match;
    let hour = parseInt(h, 10);
    if (ampm.toUpperCase() === 'PM' && hour !== 12) hour += 12;
    if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
    const startHour = 6;
    if (hour < startHour || hour > 19) return -1; // Out of bounds
    const col = hour - startHour;
    const offset = parseInt(m, 10) / 60; // percentage within the hour
    return col + offset;
  };

  const getShiftPosition = (shift: Shift) => {
    if (getEmployeeGroup(shift.employee?.role) === 'Office' && shift.shift_time) {
      const parts = shift.shift_time.split('-');
      if (parts.length === 2) {
        const start = getPositionForTime(parts[0].trim());
        const end = getPositionForTime(parts[1].trim());
        return { type: 'block', start, end };
      }
    }
    
    // Rider
    const expected = getPositionForTime(shift.expected_arrival);
    const inTime = getPositionForTime(shift.gate_in);
    const outTime = getPositionForTime(shift.gate_out);
    return { type: 'markers', expected, inTime, outTime };
  };

  return (
    <div className="w-full bg-paper rounded-2xl border border-line shadow-sm overflow-hidden animate-fade-in">
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Header row: Time columns */}
          <div className="grid grid-cols-[200px_1fr] border-b border-line bg-paper-dark">
            <div className="p-3 font-medium text-xs text-muted border-r border-line">Employee</div>
            <div className="grid" style={{ gridTemplateColumns: `repeat(${HOURS.length}, minmax(40px, 1fr))` }}>
              {HOURS.map(h => (
                <div key={h} className="p-2 border-r border-line border-dashed text-center text-[10px] font-medium text-muted">
                  {h > 12 ? h - 12 : h}{h >= 12 ? 'p' : 'a'}
                </div>
              ))}
            </div>
          </div>

          {/* Department Groups */}
          {Object.entries(grouped).map(([dept, deptShifts]) => (
            <React.Fragment key={dept}>
              {/* Department Header Row */}
              <div className="grid grid-cols-[200px_1fr] border-b border-line bg-accent/5">
                <div className="p-2 text-xs font-bold text-ink uppercase tracking-wider col-span-2">
                  {dept}
                </div>
              </div>
              
              {/* Shift Rows */}
              {deptShifts.map(shift => {
                const pos = getShiftPosition(shift);
                return (
                  <div 
                    key={shift.id} 
                    className="grid grid-cols-[200px_1fr] border-b border-line hover:bg-paper-dark/30 transition-colors group cursor-pointer"
                    onClick={() => onShiftClick?.(shift)}
                  >
                    <div className="p-3 border-r border-line flex flex-col justify-center">
                      <span className="text-xs font-medium text-ink truncate group-hover:text-accent transition-colors">{shift.employee?.full_name || 'Unassigned'}</span>
                      <span className="text-[10px] text-muted truncate">
                        {getEmployeeGroup(shift.employee?.role)}
                        {shift.break_duration_minutes ? ` • ${shift.break_duration_minutes}m break` : ''}
                      </span>
                    </div>
                    <div className="relative grid" style={{ gridTemplateColumns: `repeat(${HOURS.length}, minmax(40px, 1fr))` }}>
                      {/* Grid lines */}
                      {HOURS.map(h => (
                        <div key={h} className="border-r border-line border-dashed h-full" />
                      ))}

                      {/* Overlays */}
                      {pos.type === 'block' && pos.start !== undefined && pos.end !== undefined && pos.start !== -1 && pos.end !== -1 && (
                        <div 
                          className="absolute top-1/2 -translate-y-1/2 h-6 bg-accent/20 border border-accent/40 rounded-md"
                          style={{ 
                            left: `${(pos.start / HOURS.length) * 100}%`, 
                            width: `${((pos.end - pos.start) / HOURS.length) * 100}%` 
                          }}
                        />
                      )}

                      {pos.type === 'markers' && (
                        <>
                          {pos.expected !== undefined && pos.expected !== -1 && (
                            <div 
                              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-amber-500 rotate-45 bg-paper z-10"
                              style={{ left: `calc(${(pos.expected / HOURS.length) * 100}% - 8px)` }}
                              title={`Expected: ${shift.expected_arrival}`}
                            />
                          )}
                          {pos.inTime !== undefined && pos.inTime !== -1 && (
                            <div 
                              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-accent z-20"
                              style={{ left: `calc(${(pos.inTime / HOURS.length) * 100}% - 6px)` }}
                              title={`Gate IN: ${shift.gate_in}`}
                            />
                          )}
                          {pos.outTime !== undefined && pos.outTime !== -1 && (
                            <div 
                              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-slate-400 z-20"
                              style={{ left: `calc(${(pos.outTime / HOURS.length) * 100}% - 6px)` }}
                              title={`Gate OUT: ${shift.gate_out}`}
                            />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
      
      {/* Legend */}
      <div className="p-3 bg-paper-dark border-t border-line flex items-center gap-6 text-[10px] text-muted">
        <div className="flex items-center gap-2">
          <div className="w-4 h-3 bg-accent/20 border border-accent/40 rounded" />
          <span>Office Block</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-amber-500 rotate-45" />
          <span>Expected Arrival</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-accent" />
          <span>Gate IN</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
          <span>Gate OUT</span>
        </div>
      </div>
    </div>
  );
};
