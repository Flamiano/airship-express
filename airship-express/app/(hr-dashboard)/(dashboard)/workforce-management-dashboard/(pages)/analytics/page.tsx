'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/apiFetch';
import { ExportPrintDropdown } from '../../components/ui/ExportPrintDropdown';
import { UniversalCalendar, CalendarEvent } from '../../components/ui/UniversalCalendar';
import { Search, Sparkles, User, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function AnalyticsPage() {
  const [filter, setFilter] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [employeesData, setEmployeesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await apiFetch<any[]>('/api/employee_analytics').catch(() => []);
        setEmployeesData(data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredEmployees = employeesData.filter(e => e.name?.toLowerCase().includes(filter.toLowerCase()));
  const tardyEmployees = filteredEmployees.filter(e => e.category === 'Tardy');
  const onTimeEmployees = filteredEmployees.filter(e => e.category === 'On-Time');

  // Generate mock events for the selected employee
  const getMockEvents = (emp: any): CalendarEvent[] => {
    if (!emp) return [];
    const evts: CalendarEvent[] = [];
    const today = new Date();
    
    // Always add a shift today
    evts.push({ id: 'e1', title: 'Shift', date: today, type: 'shift', description: '08:00 AM - 05:00 PM' });
    
    if (emp.category === 'Tardy') {
      // Add some late events in the past days
      const d1 = new Date(today); d1.setDate(d1.getDate() - 2);
      const d2 = new Date(today); d2.setDate(d2.getDate() - 5);
      evts.push({ id: 'l1', title: 'Late (45m)', date: d1, type: 'late' });
      evts.push({ id: 'l2', title: 'Late (15m)', date: d2, type: 'late' });
    }
    
    return evts;
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-paper p-5 rounded-2xl border border-line shadow-sm mb-6">
        <div>
          <h1 className="text-xl font-bold text-ink">Workforce Analytics</h1>
          <p className="text-xs text-muted mt-1">
            Deep dive into employee attendance history and behavior patterns.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportPrintDropdown />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-start gap-6">
        {/* Left Column: Lists and Search (Fixed height, internally scrollable) */}
        <div className="w-full lg:w-1/3 flex flex-col gap-4 border border-line rounded-2xl bg-paper p-4 h-[550px]">
          <div className="relative shrink-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search employees..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="text-xs bg-ink/[0.03] dark:bg-paper/[0.05] border border-line rounded-xl pl-9 pr-3 py-2 text-ink placeholder:text-muted focus:outline-none focus:border-accent w-full transition-all"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-6 pr-2">
            <div>
              <h3 className="text-xs font-bold text-rose-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <AlertCircle size={14} /> Attention Needed (Tardy)
              </h3>
              <div className="space-y-2">
                {tardyEmployees.map(emp => (
                  <div
                    key={emp.id}
                    onClick={() => setSelectedEmployee(emp)}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-colors ${
                      selectedEmployee?.id === emp.id ? 'bg-accent/10 border-accent/30' : 'bg-ink/5 dark:bg-paper/5 border-transparent hover:border-line'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold text-xs shrink-0">
                      {emp.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink truncate">{emp.name}</p>
                      <p className="text-[10px] text-muted truncate">{emp.role}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-rose-500">{emp.lates} Lates</p>
                    </div>
                  </div>
                ))}
                {tardyEmployees.length === 0 && <p className="text-xs text-muted italic">No tardy employees.</p>}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <CheckCircle2 size={14} /> On-Time Performers
              </h3>
              <div className="space-y-2">
                {onTimeEmployees.map(emp => (
                  <div
                    key={emp.id}
                    onClick={() => setSelectedEmployee(emp)}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-colors ${
                      selectedEmployee?.id === emp.id ? 'bg-accent/10 border-accent/30' : 'bg-ink/5 dark:bg-paper/5 border-transparent hover:border-line'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0">
                      {emp.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink truncate">{emp.name}</p>
                      <p className="text-[10px] text-muted truncate">{emp.role}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-emerald-500">{emp.onTimeRate}</p>
                    </div>
                  </div>
                ))}
                {onTimeEmployees.length === 0 && <p className="text-xs text-muted italic">No on-time employees.</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Center: Universal Calendar for Employee History (Dynamic sizing with margin/padding) */}
        <div className="w-full lg:w-1/3 flex flex-col gap-4">
          <div className="bg-paper border border-line rounded-2xl p-4 shadow-sm">
            {selectedEmployee ? (
              <UniversalCalendar 
                events={getMockEvents(selectedEmployee)} 
                initialView="month"
                readOnly 
                className="border border-line rounded-xl overflow-hidden shadow-none bg-transparent" 
              />
            ) : (
              <div className="flex flex-col items-center justify-center border border-dashed border-line rounded-xl bg-paper/50 py-16">
                <User size={32} className="text-muted/50 mb-2" />
                <p className="text-xs text-muted font-medium">Select an employee to view history</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Detail Card & AI Summary (Dynamic sizing) */}
        <div className="w-full lg:w-1/3 flex flex-col gap-4">
          {selectedEmployee ? (
            <div className="bg-paper border border-line p-5 rounded-2xl shrink-0 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-accent/10 text-accent flex items-center justify-center font-bold text-lg">
                  {selectedEmployee.avatar}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-ink">{selectedEmployee.name}</h2>
                  <p className="text-xs text-muted">{selectedEmployee.role}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 py-4 border-y border-line">
                <div>
                  <p className="text-[10px] text-muted uppercase">On-Time Rate</p>
                  <p className="text-lg font-semibold text-ink">{selectedEmployee.onTimeRate}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted uppercase">Recent Lates</p>
                  <p className="text-lg font-semibold text-rose-500">{selectedEmployee.lates}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-[160px] border border-dashed border-line rounded-2xl bg-paper/50 shrink-0" />
          )}

          <div className="bg-gradient-to-b from-accent/5 to-transparent border border-accent/20 rounded-2xl p-5 relative overflow-hidden flex flex-col pb-12 shadow-sm">
            <div className="flex items-center gap-2 text-accent mb-4">
              <Sparkles size={16} />
              <h3 className="text-sm font-semibold">AI Behavioral Summary</h3>
            </div>
            
            {selectedEmployee ? (
              <div className="space-y-4">
                <div className="h-3 bg-accent/10 rounded-full w-full animate-pulse" />
                <div className="h-3 bg-accent/10 rounded-full w-5/6 animate-pulse" />
                <div className="h-3 bg-accent/10 rounded-full w-4/5 animate-pulse" />
                <div className="h-3 bg-accent/10 rounded-full w-2/3 animate-pulse" />
              </div>
            ) : (
              <p className="text-xs text-accent/60 mt-4 mb-4">Waiting for employee selection...</p>
            )}

            <div className="absolute bottom-4 left-0 w-full flex justify-center">
              <span className="text-[10px] font-medium bg-accent/10 text-accent px-2 py-1 rounded-full border border-accent/20">
                AI Auto-Summarization
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

