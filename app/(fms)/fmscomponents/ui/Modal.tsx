import React, { useEffect, useId } from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = "max-w-lg",
}: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className={`w-full ${maxWidth} bg-card border border-border rounded-2xl shadow-xl flex flex-col max-h-[90vh]`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
          <h2
            id={titleId}
            className="text-lg font-semibold text-foreground tracking-tight"
          >
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[#e5167e]/50"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 text-sm text-foreground">
          {children}
        </div>

        {footer && (
          <div className="px-6 py-4 border-t border-border/60 bg-muted/20 rounded-b-2xl flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}