// app/(supplyChain)/components/ui/SearchableDropdown.tsx
'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';

export interface SearchableDropdownOption {
    value: string;
    label: string;
    subLabel?: string;
    count?: number;
    icon?: string;
    badgeTone?: 'pink' | 'emerald' | 'blue' | 'amber' | 'neutral';
}

export interface SearchableDropdownProps {
    value: string;
    onChange: (value: string) => void;
    options: SearchableDropdownOption[];
    placeholder?: string;
    searchPlaceholder?: string;
    icon?: string;
    allOptionLabel?: string;
    unassignedOptionLabel?: string;
    hasUnassigned?: boolean;
    hideAllOption?: boolean;
    disabled?: boolean;
    className?: string;
    title?: string;
    align?: 'left' | 'right';
    emptyValue?: string;
    tone?: 'pink' | 'amber';
}

export function SearchableDropdown({
    value,
    onChange,
    options = [],
    placeholder = 'Select option...',
    searchPlaceholder = 'Search...',
    icon = 'fas fa-filter',
    allOptionLabel = 'All Options',
    unassignedOptionLabel = 'Unassigned',
    hasUnassigned = false,
    hideAllOption = false,
    disabled = false,
    className = '',
    title,
    align = 'left',
    emptyValue = '',
    tone = 'pink',
}: SearchableDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const triggerRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Open/close positioning & event listeners
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node;
            if (
                triggerRef.current &&
                !triggerRef.current.contains(target) &&
                popoverRef.current &&
                !popoverRef.current.contains(target)
            ) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
                setSearchTerm('');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    // Auto-focus search input when opened
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            const timer = setTimeout(() => {
                searchInputRef.current?.focus();
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Find current selected option
    const selectedOption = useMemo(() => {
        if (!value || value === emptyValue) return null;
        if (value === 'unassigned') {
            return { value: 'unassigned', label: unassignedOptionLabel, count: undefined };
        }
        return options.find((opt) => opt.value.toLowerCase() === value.toLowerCase()) || { value, label: value };
    }, [value, options, unassignedOptionLabel, emptyValue]);

    // Filter options based on search query
    const filteredOptions = useMemo(() => {
        if (!searchTerm.trim()) return options;
        const term = searchTerm.toLowerCase().trim();
        return options.filter(
            (opt) =>
                opt.label.toLowerCase().includes(term) ||
                (opt.subLabel && opt.subLabel.toLowerCase().includes(term)) ||
                (opt.value && opt.value.toLowerCase().includes(term))
        );
    }, [options, searchTerm]);

    const handleSelect = useCallback(
        (val: string) => {
            if (hideAllOption && val === value) {
                onChange(emptyValue);
            } else {
                onChange(val);
            }
            setIsOpen(false);
            setSearchTerm('');
        },
        [onChange, hideAllOption, value, emptyValue]
    );

    const handleClear = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            onChange(emptyValue);
            setSearchTerm('');
        },
        [onChange, emptyValue]
    );

    const isSelected = Boolean(value && value !== emptyValue);

    return (
        <div className={`relative inline-block ${className}`} title={title}>
            {/* Trigger Button */}
            <button
                ref={triggerRef}
                type="button"
                disabled={disabled}
                onClick={() => setIsOpen((prev) => !prev)}
                className={`w-full min-h-[38px] appearance-none rounded-xl px-3 py-1.5 text-xs font-semibold flex items-center justify-between gap-2 transition-all cursor-pointer select-none text-left ${
                    isSelected
                        ? tone === 'amber'
                            ? 'bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300/80 dark:border-amber-800 text-amber-700 dark:text-amber-300 shadow-[inset_1px_1px_2px_rgba(245,158,11,0.1)]'
                            : 'bg-pink-50/90 dark:bg-pink-950/40 border border-pink-300/80 dark:border-pink-800 text-pink-700 dark:text-pink-300 shadow-[inset_1px_1px_2px_rgba(236,72,153,0.1)]'
                        : 'bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-slate-100 hover:border-slate-300 dark:hover:border-slate-700 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)]'
                } ${isOpen ? (tone === 'amber' ? 'ring-2 ring-amber-500/30 border-amber-500 dark:border-amber-500' : 'ring-2 ring-pink-500/30 border-pink-500 dark:border-pink-500') : ''}`}
            >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <i
                        className={`${icon} text-xs shrink-0 ${
                            isSelected
                                ? tone === 'amber'
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-pink-600 dark:text-pink-400'
                                : 'text-slate-400 dark:text-slate-500'
                        }`}
                    />
                    <span className="truncate">
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                    {selectedOption?.count !== undefined && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold shrink-0 ${
                            tone === 'amber'
                                ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300'
                                : 'bg-pink-100 dark:bg-pink-900/60 text-pink-700 dark:text-pink-300'
                        }`}>
                            {selectedOption.count}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-1">
                    {isSelected && (
                        <span
                            role="button"
                            tabIndex={0}
                            onClick={handleClear}
                            className={`p-0.5 rounded-full transition-colors ${
                                tone === 'amber'
                                    ? 'hover:bg-amber-200/60 dark:hover:bg-amber-900/60 text-amber-600 dark:text-amber-400'
                                    : 'hover:bg-pink-200/60 dark:hover:bg-pink-900/60 text-pink-600 dark:text-pink-400'
                            }`}
                            title="Clear selection"
                        >
                            <i className="fas fa-times text-[10px]" />
                        </span>
                    )}
                    <i
                        className={`fas fa-chevron-down text-[10px] text-slate-400 transition-transform duration-200 ${
                            isOpen ? (tone === 'amber' ? 'rotate-180 text-amber-500' : 'rotate-180 text-pink-500') : ''
                        }`}
                    />
                </div>
            </button>

            {/* Local Popover Dropdown (Stays locked under the button on scroll) */}
            {isOpen && (
                <div
                    ref={popoverRef}
                    className={`absolute ${align === 'right' ? 'right-0 left-auto' : 'left-0 right-auto'} top-full mt-1.5 min-w-[220px] w-full sm:w-auto max-w-[calc(100vw-2rem)] sm:max-w-xs z-50 rounded-2xl bg-[#EEF2F6] dark:bg-[#161A23] border border-white/80 dark:border-white/[0.08] shadow-[0_12px_36px_rgba(0,0,0,0.18)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.85)] p-2.5 space-y-2 animate-in fade-in zoom-in-95 duration-100 backdrop-blur-xl`}
                >
                    {/* Search Input Box */}
                    <div className="relative">
                        <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs pointer-events-none" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={searchPlaceholder}
                            className={`w-full bg-[#EAF0F6] dark:bg-[#12141C] border border-slate-200/80 dark:border-slate-800 rounded-xl px-3 py-1.5 pl-8 pr-7 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-all shadow-[inset_1px_1px_2px_rgba(0,0,0,0.06)] ${
                                tone === 'amber' ? 'focus:border-amber-500 dark:focus:border-amber-500' : 'focus:border-pink-500 dark:focus:border-pink-500'
                            }`}
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs p-0.5 cursor-pointer ${
                                    tone === 'amber' ? 'hover:text-amber-500' : 'hover:text-pink-500'
                                }`}
                            >
                                <i className="fas fa-times" />
                            </button>
                        )}
                    </div>

                    {/* Options List */}
                    <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1 custom-scrollbar">
                        {/* "All" Option */}
                        {!hideAllOption && (!searchTerm || 'all'.includes(searchTerm.toLowerCase())) && (
                            <button
                                type="button"
                                onClick={() => handleSelect(emptyValue)}
                                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${
                                    !isSelected
                                        ? tone === 'amber'
                                            ? 'bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 font-bold border border-amber-200/60 dark:border-amber-800/50'
                                            : 'bg-pink-50 dark:bg-pink-950/70 text-pink-700 dark:text-pink-300 font-bold border border-pink-200/60 dark:border-pink-800/50'
                                        : 'text-slate-800 dark:text-slate-200 hover:bg-[#e2eaf4] dark:hover:bg-[#1f2330]'
                                }`}
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <i className={`fas fa-list-check text-[11px] shrink-0 ${
                                        tone === 'amber' ? 'text-amber-500' : 'text-pink-500'
                                    }`} />
                                    <span className="truncate">{allOptionLabel}</span>
                                </div>
                                {!isSelected && (
                                    <i className={`fas fa-check text-[11px] shrink-0 ${
                                        tone === 'amber' ? 'text-amber-500' : 'text-pink-500'
                                    }`} />
                                )}
                            </button>
                        )}

                        {/* "Unassigned" Option */}
                        {hasUnassigned && (!searchTerm || 'unassigned'.includes(searchTerm.toLowerCase())) && (
                            <button
                                type="button"
                                onClick={() => handleSelect('unassigned')}
                                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${
                                    value === 'unassigned'
                                        ? 'bg-pink-50 dark:bg-pink-950/70 text-pink-700 dark:text-pink-300 font-bold border border-pink-200/60 dark:border-pink-800/50'
                                        : 'text-slate-800 dark:text-slate-200 hover:bg-[#e2eaf4] dark:hover:bg-[#1f2330]'
                                }`}
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <i className="fas fa-user-slash text-[11px] text-slate-400 shrink-0" />
                                    <span className="truncate">{unassignedOptionLabel}</span>
                                </div>
                                {value === 'unassigned' && (
                                    <i className="fas fa-check text-[11px] text-pink-500 shrink-0" />
                                )}
                            </button>
                        )}

                        {/* Separator if static items were shown */}
                        {hasUnassigned && filteredOptions.length > 0 && (
                            <div className="h-px bg-slate-200/70 dark:border-white/[0.06] dark:bg-white/[0.06] my-1" />
                        )}

                        {/* Filtered Dynamic Options */}
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt) => {
                                const isItemActive = value && value.toLowerCase() === opt.value.toLowerCase();
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => handleSelect(opt.value)}
                                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer group ${
                                            isItemActive
                                                ? tone === 'amber'
                                                    ? 'bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 font-bold border border-amber-200/60 dark:border-amber-800/50'
                                                    : 'bg-pink-50 dark:bg-pink-950/70 text-pink-700 dark:text-pink-300 font-bold border border-pink-200/60 dark:border-pink-800/50'
                                                : 'text-slate-800 dark:text-slate-200 hover:bg-[#e2eaf4] dark:hover:bg-[#1f2330]'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <i
                                                className={`${
                                                    opt.icon || icon
                                                } text-[11px] shrink-0 ${
                                                    isItemActive
                                                        ? tone === 'amber' ? 'text-amber-500' : 'text-pink-500'
                                                        : tone === 'amber'
                                                            ? 'text-slate-400 dark:text-slate-500 group-hover:text-amber-500'
                                                            : 'text-slate-400 dark:text-slate-500 group-hover:text-pink-500'
                                                }`}
                                            />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-xs">{opt.label}</p>
                                                {opt.subLabel && (
                                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-normal truncate">
                                                        {opt.subLabel}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                            {opt.count !== undefined && (
                                                <span
                                                    className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                                                        isItemActive
                                                            ? tone === 'amber'
                                                                ? 'bg-amber-200/80 dark:bg-amber-900/80 text-amber-800 dark:text-amber-200'
                                                                : 'bg-pink-200/80 dark:bg-pink-900/80 text-pink-800 dark:text-pink-200'
                                                            : tone === 'amber'
                                                                ? 'bg-slate-200/70 dark:bg-[#14161F] text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-white/[0.06] group-hover:bg-amber-100 dark:group-hover:bg-amber-950 group-hover:text-amber-700'
                                                                : 'bg-slate-200/70 dark:bg-[#14161F] text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-white/[0.06] group-hover:bg-pink-100 dark:group-hover:bg-pink-950 group-hover:text-pink-700'
                                                    }`}
                                                >
                                                    {opt.count}
                                                </span>
                                            )}
                                            {isItemActive && (
                                                <i className={`fas fa-check text-[11px] ${
                                                    tone === 'amber' ? 'text-amber-500' : 'text-pink-500'
                                                }`} />
                                            )}
                                        </div>
                                    </button>
                                );
                            })
                        ) : (
                            <div className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">
                                <i className="fas fa-search mb-1 text-sm block opacity-40" />
                                No results found for &ldquo;{searchTerm}&rdquo;
                            </div>
                        )}
                    </div>

                    {/* Footer Info */}
                    <div className="pt-1.5 border-t border-slate-200/70 dark:border-white/[0.06] flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 px-1">
                        <span>
                            {filteredOptions.length} of {options.length} {options.length === 1 ? 'option' : 'options'}
                        </span>
                        {isSelected && (
                            <button
                                type="button"
                                onClick={() => handleSelect(emptyValue)}
                                className={`font-bold hover:underline cursor-pointer ${
                                    tone === 'amber' ? 'text-amber-600 dark:text-amber-400' : 'text-pink-600 dark:text-pink-400'
                                }`}
                            >
                                Reset to all
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

