// app/(supplyChain)/components/ui/SearchableDropdown.tsx
'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';

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
    disabled?: boolean;
    className?: string;
    title?: string;
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
    hasUnassigned = true,
    disabled = false,
    className = '',
    title,
}: SearchableDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [coords, setCoords] = useState<{ top: number; left: number; width: number; flipUp?: boolean }>({
        top: 0,
        left: 0,
        width: 0,
        flipUp: false,
    });

    const triggerRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Calculate fixed screen position for portal
    const updatePosition = useCallback(() => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const estimatedHeight = 280;
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const flipUp = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

        const popoverWidth = Math.max(rect.width, 270);
        let left = rect.left;
        // Keep inside viewport horizontally
        if (left + popoverWidth > window.innerWidth - 12) {
            left = window.innerWidth - popoverWidth - 12;
        }
        if (left < 12) left = 12;

        const top = flipUp ? Math.max(10, rect.top - estimatedHeight - 6) : rect.bottom + 6;

        setCoords({
            top,
            left,
            width: popoverWidth,
            flipUp,
        });
    }, []);

    // Open/close positioning & event listeners
    useEffect(() => {
        if (!isOpen) return;

        updatePosition();

        const handleScrollAndResize = () => {
            updatePosition();
        };

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

        window.addEventListener('resize', handleScrollAndResize);
        window.addEventListener('scroll', handleScrollAndResize, true);
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('resize', handleScrollAndResize);
            window.removeEventListener('scroll', handleScrollAndResize, true);
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, updatePosition]);

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
        if (!value) return null;
        if (value === 'unassigned') {
            return { value: 'unassigned', label: unassignedOptionLabel, count: undefined };
        }
        return options.find((opt) => opt.value.toLowerCase() === value.toLowerCase()) || { value, label: value };
    }, [value, options, unassignedOptionLabel]);

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
            onChange(val);
            setIsOpen(false);
            setSearchTerm('');
        },
        [onChange]
    );

    const handleClear = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            onChange('');
            setSearchTerm('');
        },
        [onChange]
    );

    const isSelected = Boolean(value);

    return (
        <div className={`relative inline-block ${className}`} title={title}>
            {/* Trigger Button */}
            <button
                ref={triggerRef}
                type="button"
                disabled={disabled}
                onClick={() => {
                    updatePosition();
                    setIsOpen((prev) => !prev);
                }}
                className={`w-full min-h-[38px] appearance-none rounded-xl px-3 py-1.5 text-xs font-semibold flex items-center justify-between gap-2 transition-all cursor-pointer select-none text-left ${
                    isSelected
                        ? 'bg-pink-50/90 dark:bg-pink-950/40 border border-pink-300/80 dark:border-pink-800 text-pink-700 dark:text-pink-300 shadow-[inset_1px_1px_2px_rgba(236,72,153,0.1)]'
                        : 'bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-slate-100 hover:border-slate-300 dark:hover:border-slate-700 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)]'
                } ${isOpen ? 'ring-2 ring-pink-500/30 border-pink-500 dark:border-pink-500' : ''}`}
            >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <i
                        className={`${icon} text-xs shrink-0 ${
                            isSelected ? 'text-pink-600 dark:text-pink-400' : 'text-slate-400 dark:text-slate-500'
                        }`}
                    />
                    <span className="truncate">
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                    {selectedOption?.count !== undefined && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-pink-100 dark:bg-pink-900/60 text-pink-700 dark:text-pink-300 font-bold shrink-0">
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
                            className="p-0.5 rounded-full hover:bg-pink-200/60 dark:hover:bg-pink-900/60 text-pink-600 dark:text-pink-400 transition-colors"
                            title="Clear selection"
                        >
                            <i className="fas fa-times text-[10px]" />
                        </span>
                    )}
                    <i
                        className={`fas fa-chevron-down text-[10px] text-slate-400 transition-transform duration-200 ${
                            isOpen ? 'rotate-180 text-pink-500' : ''
                        }`}
                    />
                </div>
            </button>

            {/* Portal-rendered Popover Dropdown (Float above table & all layout containers) */}
            {isOpen &&
                typeof document !== 'undefined' &&
                createPortal(
                    <div
                        ref={popoverRef}
                        style={{
                            position: 'fixed',
                            top: `${coords.top}px`,
                            left: `${coords.left}px`,
                            width: `${coords.width}px`,
                            zIndex: 99999,
                        }}
                        className="rounded-2xl bg-white dark:bg-[#181924] border border-slate-200/80 dark:border-slate-800 shadow-[0_12px_36px_rgba(0,0,0,0.2)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.7)] p-2 space-y-1.5 animate-in fade-in zoom-in-95 duration-100 backdrop-blur-lg"
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
                                className="w-full bg-[#f0f3f8] dark:bg-[#12131b] border border-slate-200/80 dark:border-slate-800 rounded-xl px-3 py-1.5 pl-8 pr-7 text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-pink-500 dark:focus:border-pink-500 transition-all shadow-[inset_1px_1px_2px_rgba(0,0,0,0.06)]"
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pink-500 text-xs p-0.5 cursor-pointer"
                                >
                                    <i className="fas fa-times" />
                                </button>
                            )}
                        </div>

                        {/* Options List */}
                        <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1 scrollbar-thin">
                            {/* "All" Option (only show if no search filter or matches "all") */}
                            {(!searchTerm || 'all'.includes(searchTerm.toLowerCase())) && (
                                <button
                                    type="button"
                                    onClick={() => handleSelect('')}
                                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${
                                        !value
                                            ? 'bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 font-bold'
                                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 truncate">
                                        <i className="fas fa-list-check text-[11px] text-pink-500 shrink-0" />
                                        <span className="truncate">{allOptionLabel}</span>
                                    </div>
                                    {!value && <i className="fas fa-check text-[11px] text-pink-500 shrink-0" />}
                                </button>
                            )}

                            {/* "Unassigned" Option */}
                            {hasUnassigned && (!searchTerm || 'unassigned'.includes(searchTerm.toLowerCase())) && (
                                <button
                                    type="button"
                                    onClick={() => handleSelect('unassigned')}
                                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${
                                        value === 'unassigned'
                                            ? 'bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 font-bold'
                                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
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
                                <div className="h-px bg-slate-100 dark:bg-slate-800/80 my-1" />
                            )}

                            {/* Filtered Dynamic Options */}
                            {filteredOptions.length > 0 ? (
                                filteredOptions.map((opt) => {
                                    const isItemActive = value.toLowerCase() === opt.value.toLowerCase();
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => handleSelect(opt.value)}
                                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer group ${
                                                isItemActive
                                                    ? 'bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 font-bold'
                                                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                <i
                                                    className={`${
                                                        opt.icon || icon
                                                    } text-[11px] shrink-0 ${
                                                        isItemActive
                                                            ? 'text-pink-500'
                                                            : 'text-slate-400 group-hover:text-pink-500'
                                                    }`}
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-xs">{opt.label}</p>
                                                    {opt.subLabel && (
                                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-normal truncate">
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
                                                                ? 'bg-pink-200/80 dark:bg-pink-900/80 text-pink-800 dark:text-pink-200'
                                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:bg-pink-100 dark:group-hover:bg-pink-950 group-hover:text-pink-700'
                                                        }`}
                                                    >
                                                        {opt.count}
                                                    </span>
                                                )}
                                                {isItemActive && (
                                                    <i className="fas fa-check text-[11px] text-pink-500" />
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
                        <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 px-1">
                            <span>
                                {filteredOptions.length} of {options.length} {options.length === 1 ? 'option' : 'options'}
                            </span>
                            {value && (
                                <button
                                    type="button"
                                    onClick={() => handleSelect('')}
                                    className="text-pink-600 dark:text-pink-400 font-bold hover:underline cursor-pointer"
                                >
                                    Reset to all
                                </button>
                            )}
                        </div>
                    </div>,
                    document.body
                )}
        </div>
    );
}
