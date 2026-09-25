import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { SprintChart } from '../shifts/SprintChart';
import type { Shift } from '../../types/workforce';

interface CalendarModalProps {
  open: boolean;
  onClose: () => void;
  shifts?: Shift[];
  onShiftClick?: (shift: Shift) => void;
}

export function CalendarModal({ open, onClose, shifts = [], onShiftClick }: CalendarModalProps) {
  const [view, setView] = useState<'sprint' | 'month' | 'week' | 'day'>('sprint');

  // Static mock data for the calendar grid
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const mockDays = Array.from({ length: 35 }, (_, i) => i - 2); // Start a few days before 1st

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Deployment Schedule"
      icon={<CalendarIcon size={20} />}
      maxWidth="max-w-6xl"
    >
      <div className="space-y-4">
        {/* Header Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button className="p-1.5 rounded-lg border border-line hover:bg-ink/5 dark:hover:bg-paper/10 text-muted hover:text-ink transition">
              <ChevronLeft size={16} />
            </button>
            <h3 className="text-sm font-bold text-ink w-32 text-center">October 2026</h3>
            <button className="p-1.5 rounded-lg border border-line hover:bg-ink/5 dark:hover:bg-paper/10 text-muted hover:text-ink transition">
              <ChevronRight size={16} />
            </button>
          </div>
          
          <div className="flex items-center bg-ink/5 dark:bg-paper/5 p-1 rounded-xl">
            <button
              onClick={() => setView('sprint')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                view === 'sprint' ? 'bg-paper text-ink shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              Sprint Timeline
            </button>
            <button
              onClick={() => setView('month')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                view === 'month' ? 'bg-paper text-ink shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setView('week')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                view === 'week' ? 'bg-paper text-ink shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setView('day')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                view === 'day' ? 'bg-paper text-ink shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              Day
            </button>
          </div>
        </div>

        {view === 'sprint' ? (
          <div className="mt-4">
            <SprintChart shifts={shifts} onShiftClick={onShiftClick} />
          </div>
        ) : (
          <div className="bg-ink/[0.02] dark:bg-paper/[0.02] rounded-xl border border-line overflow-hidden mt-4">
            {view === 'month' && (
              <>
                {/* Day Headers */}
                <div className="grid grid-cols-7 border-b border-line bg-ink/[0.04] dark:bg-paper/[0.05]">
                  {daysOfWeek.map(day => (
                    <div key={day} className="py-2 text-center text-[10px] font-bold text-muted uppercase tracking-wider">
                      {day}
                    </div>
                  ))}
                </div>
                {/* Day Cells */}
                <div className="grid grid-cols-7">
                  {mockDays.map((day, i) => {
                    const isCurrentMonth = day > 0 && day <= 31;
                    const isToday = day === 15;
                    const hasShift = day === 12 || day === 18 || day === 22;
                    return (
                      <div
                        key={i}
                        className={`min-h-[100px] p-2 border-b border-r border-line hover:bg-ink/[0.03] dark:hover:bg-paper/[0.04] transition cursor-pointer ${
                          !isCurrentMonth ? 'opacity-30 bg-ink/[0.02] dark:bg-paper/[0.02]' : ''
                        }`}
                      >
                        <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium mb-2 ${
                          isToday ? 'bg-accent text-white shadow-sm' : 'text-ink'
                        }`}>
                          {isCurrentMonth ? day : (day <= 0 ? 30 + day : day - 31)}
                        </div>
                        
                        {/* Mock Schedule Pills */}
                        {hasShift && (
                          <div className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold truncate mb-1">
                            Office Schedule
                          </div>
                        )}
                        {day === 25 && (
                          <div className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold truncate">
                            Fully Staffed
                          </div>
                        )}
                        {isToday && (
                          <div className="px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400 text-[10px] font-bold truncate">
                            3 Pending Dispatch
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {view !== 'month' && (
              <div className="flex items-center justify-center min-h-[400px] text-muted text-xs p-6 text-center">
                {view === 'week' ? 'Weekly schedule timeline goes here.' : 'Daily hour-by-hour timeline goes here.'}
                <br />
                (Prototype Mode placeholder)
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button onClick={onClose} variant="secondary">Close Calendar</Button>
        </div>
      </div>
    </Modal>
  );
}
