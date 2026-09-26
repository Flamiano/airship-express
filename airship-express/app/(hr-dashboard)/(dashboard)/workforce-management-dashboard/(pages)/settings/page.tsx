'use client';

import React, { useState } from 'react';
import { Save, AlertCircle } from 'lucide-react';
import { ExportPrintDropdown } from '../../components/ui/ExportPrintDropdown';

export default function SettingsPage() {
  const [lateThreshold, setLateThreshold] = useState('15');
  const [absentThreshold, setAbsentThreshold] = useState('120');
  const [awolThreshold, setAwolThreshold] = useState('3');
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-paper p-5 rounded-2xl border border-line shadow-sm mb-6">
        <div>
          <h1 className="text-xl font-bold text-ink">System Settings</h1>
          <p className="text-xs text-muted mt-1">
            Configure workforce thresholds and backend parameters.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportPrintDropdown />
        </div>
      </div>

      <div className="max-w-2xl bg-paper p-6 rounded-2xl border border-line shadow-2xs">
        <div className="mb-6 pb-6 border-b border-line">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-base font-semibold text-ink">Data Simulation Mode</h2>
              <p className="text-xs text-muted mt-1">
                Temporarily detach from the backend API and simulate all workforce data.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={typeof window !== 'undefined' && localStorage.getItem('simulation_mode') === 'true'}
                onChange={(e) => {
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('simulation_mode', e.target.checked ? 'true' : 'false');
                    window.location.reload(); // Reload to re-fetch data instantly
                  }
                }}
              />
              <div className="w-11 h-6 bg-ink/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
            </label>
          </div>
        </div>

        <div className="mb-6 pb-4 border-b border-line flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink">Attendance Thresholds</h2>
            <p className="text-xs text-muted mt-1">Define the boundaries for automated tagging.</p>
          </div>
          <AlertCircle size={20} className="text-muted" />
        </div>

        <div className="space-y-6">
          <div className="grid gap-2">
            <label className="text-sm font-medium text-ink">Late Threshold (Minutes)</label>
            <p className="text-[10px] text-muted">Minutes past schedule before an employee is tagged as Tardy.</p>
            <input
              type="number"
              value={lateThreshold}
              onChange={(e) => setLateThreshold(e.target.value)}
              className="w-full max-w-xs bg-ink/5 dark:bg-paper/5 border border-line rounded-xl px-4 py-2 text-sm text-ink focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-ink">Absent Threshold (Minutes)</label>
            <p className="text-[10px] text-muted">Minutes past schedule before an employee is tagged as Absent.</p>
            <input
              type="number"
              value={absentThreshold}
              onChange={(e) => setAbsentThreshold(e.target.value)}
              className="w-full max-w-xs bg-ink/5 dark:bg-paper/5 border border-line rounded-xl px-4 py-2 text-sm text-ink focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-ink">AWOL Threshold (Days)</label>
            <p className="text-[10px] text-muted">Consecutive days absent before an employee is tagged as AWOL.</p>
            <input
              type="number"
              value={awolThreshold}
              onChange={(e) => setAwolThreshold(e.target.value)}
              className="w-full max-w-xs bg-ink/5 dark:bg-paper/5 border border-line rounded-xl px-4 py-2 text-sm text-ink focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          <div className="pt-6 border-t border-line flex items-center gap-4">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent/90 transition-colors"
            >
              <Save size={16} />
              Save Configuration
            </button>
            {isSaved && (
              <span className="text-xs font-medium text-emerald-500 animate-pulse">
                Changes saved successfully!
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

