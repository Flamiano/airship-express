'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isSameMonth, startOfMonth, endOfMonth } from 'date-fns';

export type CalendarView = 'month' | 'week' | 'day';

export interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type?: 'shift' | 'leave' | 'late' | 'absent' | 'default';
  description?: string;
}

interface UniversalCalendarProps {
  initialView?: CalendarView;
  events?: CalendarEvent[];
  onDateSelect?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  readOnly?: boolean;
  className?: string;
}

export function UniversalCalendar({
  initialView = 'month',
  events = [],
  onDateSelect,
  onEventClick,
  readOnly = false,
  className = '',
}: UniversalCalendarProps) {
  const [view, setView] = useState<CalendarView>(initialView);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const handlePrev = () => {
    if (view === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subDays(currentDate, 1));
  };

  const handleNext = () => {
    if (view === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const handleDateClick = (date: Date) => {
    if (readOnly) return;
    setSelectedDate(date);
    if (onDateSelect) onDateSelect(date);
  };

  const renderHeader = () => (
    <div className="flex items-center justify-between px-4 py-3 border-b border-line">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-ink">
          {view === 'month' && format(currentDate, 'MMMM yyyy')}
          {view === 'week' && `Week of ${format(startOfWeek(currentDate), 'MMM d, yyyy')}`}
          {view === 'day' && format(currentDate, 'EEEE, MMM d, yyyy')}
        </h2>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex bg-line rounded-lg p-0.5">
          {(['month', 'week', 'day'] as CalendarView[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                view === v ? 'bg-paper text-ink shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrev}
            className="p-1.5 rounded-lg text-muted hover:bg-line hover:text-ink transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={handleToday}
            className="px-3 py-1.5 text-xs font-medium rounded-lg text-muted hover:bg-line hover:text-ink transition-colors"
          >
            Today
          </button>
          <button
            onClick={handleNext}
            className="p-1.5 rounded-lg text-muted hover:bg-line hover:text-ink transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const dateFormat = 'd';
    const rows = [];

    let days = [];
    let day = startDate;
    let formattedDate = '';

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, dateFormat);
        const cloneDay = day;
        const isCurrentMonth = isSameMonth(day, monthStart);
        const isSelected = isSameDay(day, selectedDate);
        const dayEvents = events.filter((e) => isSameDay(e.date, cloneDay));

        days.push(
          <div
            key={day.toString()}
            onClick={() => handleDateClick(cloneDay)}
            className={`min-h-[100px] p-2 border-r border-b border-line transition-colors ${
              !isCurrentMonth ? 'bg-paper/40 text-muted/50' : 'bg-paper text-ink'
            } ${!readOnly ? 'cursor-pointer hover:bg-line/30' : ''} ${
              isSelected && !readOnly ? 'ring-1 ring-inset ring-accent bg-accent/5' : ''
            }`}
          >
            <span className={`text-sm font-medium ${isSameDay(cloneDay, new Date()) ? 'flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white' : ''}`}>
              {formattedDate}
            </span>
            <div className="mt-2 space-y-1">
              {dayEvents.map((evt) => (
                <div
                  key={evt.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onEventClick) onEventClick(evt);
                  }}
                  className={`px-1.5 py-0.5 text-[10px] font-medium rounded truncate ${
                    evt.type === 'leave' ? 'bg-amber-500/10 text-amber-600' :
                    evt.type === 'shift' ? 'bg-accent/10 text-accent' :
                    evt.type === 'absent' ? 'bg-rose-500/10 text-rose-600' :
                    evt.type === 'late' ? 'bg-orange-500/10 text-orange-600' :
                    'bg-slate-500/10 text-slate-600'
                  }`}
                >
                  {evt.title}
                </div>
              ))}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="grid grid-cols-7" key={day.toString()}>
          {days}
        </div>
      );
      days = [];
    }

    return (
      <div className="flex flex-col">
        <div className="grid grid-cols-7 border-b border-line bg-paper/50">
          {weekDays.map((wd) => (
            <div key={wd} className="py-2 text-center text-xs font-semibold text-muted uppercase">
              {wd}
            </div>
          ))}
        </div>
        <div>{rows}</div>
      </div>
    );
  };

  const renderWeekView = () => {
    const startDate = startOfWeek(currentDate);
    const endDate = endOfWeek(currentDate);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    return (
      <div className="flex flex-col h-[500px] overflow-y-auto">
        <div className="grid grid-cols-7 sticky top-0 bg-paper border-b border-line z-10">
          {days.map((day) => (
            <div key={day.toString()} className="py-3 text-center border-r border-line last:border-0">
              <div className="text-xs font-semibold text-muted uppercase">{format(day, 'EEE')}</div>
              <div className={`mt-1 text-sm font-medium ${isSameDay(day, new Date()) ? 'inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent text-white' : 'text-ink'}`}>
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 flex-1">
          {days.map((day) => {
            const dayEvents = events.filter((e) => isSameDay(e.date, day));
            return (
              <div key={day.toString()} className="border-r border-line p-2 last:border-0 min-h-[400px]">
                <div className="space-y-2">
                  {dayEvents.map((evt) => (
                    <div
                      key={evt.id}
                      onClick={() => onEventClick && onEventClick(evt)}
                      className="p-2 rounded-lg bg-accent/10 border border-accent/20 cursor-pointer hover:bg-accent/20 transition-colors"
                    >
                      <p className="text-xs font-semibold text-accent">{evt.title}</p>
                      {evt.description && <p className="text-[10px] text-accent/80 mt-1">{evt.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const dayEvents = events.filter((e) => isSameDay(e.date, currentDate));
    return (
      <div className="p-4 h-[500px] overflow-y-auto">
        <div className="max-w-3xl mx-auto space-y-4">
          {dayEvents.length === 0 ? (
            <div className="text-center py-10 text-muted">No events scheduled for this day.</div>
          ) : (
            dayEvents.map((evt) => (
              <div
                key={evt.id}
                className="flex gap-4 p-4 rounded-xl border border-line bg-paper hover:border-accent/30 transition-colors"
              >
                <div className="flex-shrink-0 pt-1 text-muted">
                  <Clock size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-ink">{evt.title}</h4>
                  {evt.description && <p className="text-xs text-muted mt-1">{evt.description}</p>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`flex flex-col bg-paper border border-line rounded-2xl overflow-hidden shadow-sm ${className}`}>
      {renderHeader()}
      <div className="flex-1 bg-ink/5 dark:bg-paper/5">
        {view === 'month' && renderMonthView()}
        {view === 'week' && renderWeekView()}
        {view === 'day' && renderDayView()}
      </div>
    </div>
  );
}
