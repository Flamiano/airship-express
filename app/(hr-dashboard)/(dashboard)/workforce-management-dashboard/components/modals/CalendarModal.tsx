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
}

export function CalendarModal({ open, onClose, shifts = [] }: CalendarModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Sprint Chart / Timeline"
      icon={<CalendarIcon size={20} />}
    >
      <div className="space-y-4">
        <p className="text-xs text-muted">
          Visualize active shifts and dispatch schedules across the daily timeline.
        </p>
        
        {/* Render the Sprint Chart */}
        <SprintChart shifts={shifts} />

        <div className="flex justify-end pt-2">
          <Button onClick={onClose} variant="secondary">Close Calendar</Button>
        </div>
      </div>
    </Modal>
  );
}
