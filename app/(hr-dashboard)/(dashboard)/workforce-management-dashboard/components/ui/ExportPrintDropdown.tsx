'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';

interface ExportPrintDropdownProps {
  className?: string;
}

export function ExportPrintDropdown({ className = '' }: ExportPrintDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExport = (type: 'pdf' | 'csv') => {
    // Non-functional for prototype as requested
    console.log(`Exporting as ${type}...`);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center h-9 px-3 rounded-lg border border-line bg-paper text-muted hover:text-ink hover:border-accent/30 transition-colors"
        aria-label="Export or Print"
      >
        <Download size={16} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-paper border border-line rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-line bg-ink/5 dark:bg-paper/5">
            <span className="text-xs font-semibold text-ink">Export Options</span>
          </div>
          <button
            onClick={() => handleExport('pdf')}
            className="w-full text-left px-3 py-2.5 text-xs text-ink hover:bg-ink/[0.03] dark:hover:bg-paper/[0.04] transition-colors flex items-center gap-2"
          >
            <FileText size={14} className="text-rose-500" />
            Export to PDF
          </button>
          <button
            onClick={() => handleExport('csv')}
            className="w-full text-left px-3 py-2.5 text-xs text-ink hover:bg-ink/[0.03] dark:hover:bg-paper/[0.04] transition-colors flex items-center gap-2"
          >
            <FileSpreadsheet size={14} className="text-emerald-500" />
            Export to CSV
          </button>
        </div>
      )}
    </div>
  );
}
