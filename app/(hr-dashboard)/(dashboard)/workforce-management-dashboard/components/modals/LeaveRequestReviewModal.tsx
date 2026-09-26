'use client';

import React from 'react';
import { X, Calendar as CalendarIcon, Check, ShieldAlert } from 'lucide-react';
import { UniversalCalendar, CalendarEvent } from '../ui/UniversalCalendar';

interface LeaveRequestReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: any; // Using any for mock prototype
}

export function LeaveRequestReviewModal({ isOpen, onClose, request }: LeaveRequestReviewModalProps) {
  if (!isOpen || !request) return null;

  // Mock events for the calendar to cross-reference
  const events: CalendarEvent[] = [
    {
      id: '1',
      title: `${request.name} (Leave)`,
      date: new Date(), // Today for prototype simplicity
      type: 'leave',
      description: request.type,
    },
    {
      id: '2',
      title: 'Dave Wilson (Shift)',
      date: new Date(),
      type: 'shift',
      description: 'MNL-CEB Route',
    }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-paper text-ink rounded-3xl border border-line shadow-2xl w-full max-w-4xl p-6 flex flex-col h-[85vh] animate-modal">
        <div className="flex items-center justify-between border-b border-line pb-4 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-ink">Review Leave Request</h3>
            <p className="text-xs text-muted mt-1">Cross-reference schedules before approval.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full text-muted hover:bg-line/50 hover:text-ink transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 gap-6 mt-6 overflow-hidden">
          {/* Left Panel: Request Details */}
          <div className="w-1/3 flex flex-col gap-4 overflow-y-auto pr-2">
            <div className="p-4 rounded-xl bg-ink/5 dark:bg-paper/5 border border-line">
              <h4 className="text-sm font-semibold text-ink">{request.name}</h4>
              <p className="text-xs text-muted">{request.role}</p>
              
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Type:</span>
                  <span className="font-medium">{request.type}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Duration:</span>
                  <span className="font-medium">{request.duration}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Remaining Balance:</span>
                  <span className="font-medium text-accent">{request.balance} Days</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
              <div className="flex items-start gap-2">
                <ShieldAlert size={16} className="mt-0.5" />
                <p className="text-xs font-medium">
                  Approving this leave will reduce the available active workforce on {request.duration}. Please check the calendar for shift conflicts.
                </p>
              </div>
            </div>

            <div className="mt-auto space-y-2 pt-4">
              <button onClick={onClose} className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-semibold hover:bg-emerald-600 transition-colors">
                <Check size={16} />
                Approve Request
              </button>
              <button onClick={onClose} className="w-full flex items-center justify-center gap-2 py-2.5 bg-rose-500/10 text-rose-500 rounded-xl text-sm font-semibold hover:bg-rose-500/20 transition-colors">
                <X size={16} />
                Reject
              </button>
            </div>
          </div>

          {/* Right Panel: Universal Calendar */}
          <div className="flex-1 flex flex-col h-full overflow-hidden border border-line rounded-2xl">
            <UniversalCalendar events={events} readOnly />
          </div>
        </div>
      </div>
    </div>
  );
}
