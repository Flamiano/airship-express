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

/** Shared modal shell with pink backdrop + card, used by all modals. */
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
 <div className="fixed inset-0 z-50 bg-pink-950/40 backdrop-blur-sm flex items-center justify-center p-4">
 <div
 className={`bg-white rounded-2xl ${maxWidth} w-full p-6 space-y-4 border border-pink-200 shadow-2xl animate-modal`}
 role="dialog"
 aria-modal="true"
 >
 <div className="flex items-center justify-between border-b border-pink-100 pb-3">
 <div className="flex items-center gap-2">
 {icon && <div className="p-2 bg-pink-100 rounded-xl text-pink-600">{icon}</div>}
 <div>
 <h3 className="font-bold text-base text-pink-950">{title}</h3>
 {subtitle && <p className="text-xs text-pink-500">{subtitle}</p>}
 </div>
 </div>
 <button
 onClick={onClose}
 aria-label="Close"
 className="p-1 text-pink-400 hover:text-pink-700 transition"
 >
 <X size={20} />
 </button>
 </div>
 {children}
 </div>
 </div>
 );
}
