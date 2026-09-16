import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
}

/** Shared modal shell with theme backdrop + card, used by all modals. */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  maxWidth = 'max-w-md',
}: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className={`bg-paper text-ink rounded-2xl ${maxWidth} w-full p-6 space-y-4 border border-line shadow-2xl animate-modal`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2.5">
            {icon && <div className="p-2 bg-accent/10 rounded-xl text-accent">{icon}</div>}
            <div>
              <h3 className="font-semibold text-base text-ink">{title}</h3>
              {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 text-muted hover:text-ink transition rounded-lg hover:bg-ink/[0.05] dark:hover:bg-paper/[0.1]"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

