// app/(supplyChain)/inventory/components/modals/ScannerStatsModal.tsx
'use client';
import { useState, useMemo } from 'react';
import Portal from '../../../../components/client/Portal';
import { AppButton } from '../../../../components/ui/AppButton';
import { ScannerUser } from '../../types';
import { toast } from 'sonner';

interface ScannerStatsModalProps {
    isOpen: boolean;
    onClose: () => void;
    scanners: ScannerUser[];
    onSelectScanner: (scannerId: string) => void;
    selectedScannerId?: string;
    totalParcelsCount?: number;
}

export function ScannerStatsModal({
    isOpen,
    onClose,
    scanners = [],
    onSelectScanner,
    selectedScannerId = '',
    totalParcelsCount = 0,
}: ScannerStatsModalProps) {
    const [searchTerm, setSearchTerm] = useState('');

    const totalScans = useMemo(() => {
        return scanners.reduce((sum, s) => sum + (s.scanned_count || 0), 0);
    }, [scanners]);

    const activeScannersCount = useMemo(() => {
        return scanners.filter(s => s.id !== 'unassigned' && s.scanned_count > 0).length;
    }, [scanners]);

    const topScanner = useMemo(() => {
        const assigned = scanners.filter(s => s.id !== 'unassigned');
        return assigned.length > 0 ? assigned[0] : null;
    }, [scanners]);

    const filteredScanners = useMemo(() => {
        const query = searchTerm.toLowerCase().trim();
        if (!query) return scanners;
        return scanners.filter(s =>
            (s.name || '').toLowerCase().includes(query) ||
            (s.email || '').toLowerCase().includes(query) ||
            (s.role || '').toLowerCase().includes(query) ||
            (s.id || '').toLowerCase().includes(query)
        );
    }, [scanners, searchTerm]);

    const handleCardClick = (scanner: ScannerUser) => {
        onSelectScanner(scanner.id);
        onClose();
        if (scanner.id === 'unassigned') {
            toast.info('Filtered parcels: Unassigned / Legacy scans');
        } else {
            toast.success(`Filtered parcels scanned by ${scanner.name} (${scanner.scanned_count} scans)`);
        }
    };

    const handleClearSelection = () => {
        onSelectScanner('');
        onClose();
        toast.info('Cleared scanner filter. Showing all parcels.');
    };

    if (!isOpen) return null;

    return (
        <Portal>
            <div
                className="fixed inset-0 bg-slate-950/70 dark:bg-black/80 backdrop-blur-md flex items-center justify-center z-[9999] p-3 sm:p-4 transition-all duration-300 animate-in fade-in"
                onClick={onClose}
            >
                <div
                    className="bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-white/80 dark:border-[#2c2d3c] overflow-hidden transform transition-all duration-200 animate-in zoom-in-95"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Modal Header */}
                    <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200/60 dark:border-slate-800/80 shrink-0 bg-[#ebf0f7]/80 dark:bg-[#14151e]/80 backdrop-blur-md">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] flex items-center justify-center text-base shrink-0 text-pink-500">
                                <i className="fas fa-qrcode"></i>
                            </div>
                            <div>
                                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2 leading-tight">
                                    <span>Parcel Scanner Activity</span>
                                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-xl bg-[#ebf0f7] dark:bg-[#14151e] text-pink-600 dark:text-pink-400 border border-white/80 dark:border-slate-800 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)] dark:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5)]">
                                        {scanners.length} Records
                                    </span>
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Click any scanner card to filter the Parcels tab by that operator
                                </p>
                            </div>
                        </div>
                        <AppButton
                            type="button"
                            variant="neutral"
                            size="icon-sm"
                            onClick={onClose}
                            aria-label="Close modal"
                        >
                            <i className="fas fa-times text-xs"></i>
                        </AppButton>
                    </div>

                    {/* Quick Stats Strip */}
                    <div className="p-4 sm:px-6 bg-[#ebf0f7]/60 dark:bg-[#14151c]/60 border-b border-slate-200/60 dark:border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
                        <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-[#e4ebf5] dark:bg-[#191a24] text-blue-600 dark:text-blue-400 border border-white/80 dark:border-slate-700/50 shadow-[1px_1px_3px_rgba(166,175,195,0.3),-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)] flex items-center justify-center text-xs shrink-0">
                                <i className="fas fa-boxes-stacked"></i>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Total Scanned</p>
                                <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{totalScans}</p>
                            </div>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-[#e4ebf5] dark:bg-[#191a24] text-purple-600 dark:text-purple-400 border border-white/80 dark:border-slate-700/50 shadow-[1px_1px_3px_rgba(166,175,195,0.3),-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)] flex items-center justify-center text-xs shrink-0">
                                <i className="fas fa-users-gear"></i>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Active Scanners</p>
                                <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{activeScannersCount}</p>
                            </div>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] flex items-center gap-3 col-span-2 sm:col-span-2">
                            <div className="w-8 h-8 rounded-xl bg-[#e4ebf5] dark:bg-[#191a24] text-amber-500 dark:text-amber-400 border border-white/80 dark:border-slate-700/50 shadow-[1px_1px_3px_rgba(166,175,195,0.3),-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)] flex items-center justify-center text-xs shrink-0">
                                <i className="fas fa-crown"></i>
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Top Scanner</p>
                                <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100 truncate">
                                    {topScanner ? `${topScanner.name} (${topScanner.scanned_count} scans)` : 'N/A'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Search & Filter Toolbar inside Modal */}
                    <div className="p-4 sm:px-6 bg-[#f0f3f8] dark:bg-[#161722] border-b border-slate-200/60 dark:border-slate-800/80 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between shrink-0">
                        <div className="relative flex-1 group">
                            <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-pink-500 text-xs pointer-events-none transition-colors"></i>
                            <input
                                type="search"
                                className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-slate-800 rounded-xl px-3 py-2 pl-9 text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 transition-all"
                                placeholder="Search by scanner name, role, email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {selectedScannerId && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-pink-600 dark:text-pink-400 font-bold bg-[#ebf0f7] dark:bg-[#14151e] px-3 py-1.5 rounded-xl border border-white/80 dark:border-slate-800 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)] dark:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5)] flex items-center gap-1.5">
                                    <i className="fas fa-filter text-[10px]"></i>
                                    <span>Filter Active</span>
                                </span>
                                <button
                                    type="button"
                                    onClick={handleClearSelection}
                                    className="px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-[#ebf0f7] dark:bg-[#14151e] hover:text-pink-600 dark:hover:text-pink-400 border border-white/80 dark:border-slate-800 shadow-[2px_2px_5px_rgba(166,175,195,0.3),-2px_-2px_5px_rgba(255,255,255,0.8)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)] active:scale-95 rounded-xl transition-all cursor-pointer"
                                >
                                    Clear Filter
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Cards Grid */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#f0f3f8] dark:bg-[#14151c] overscroll-contain">
                        {filteredScanners.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="w-12 h-12 rounded-2xl bg-[#ebf0f7] dark:bg-[#191a24] border border-white/80 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] flex items-center justify-center text-slate-400 mx-auto mb-3">
                                    <i className="fas fa-user-slash text-lg"></i>
                                </div>
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No scanner matches found</p>
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Try adjusting your search query</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {filteredScanners.map((scanner) => {
                                    const isSelected = selectedScannerId === scanner.id;
                                    const percentage = totalScans > 0 ? Math.round((scanner.scanned_count / totalScans) * 100) : 0;
                                    const isUnassigned = scanner.id === 'unassigned';
                                    const statuses = Object.entries(scanner.status_counts || {});

                                    return (
                                        <div
                                            key={scanner.id}
                                            onClick={() => handleCardClick(scanner)}
                                            className={`group relative p-4 sm:p-5 rounded-2xl transition-all duration-200 cursor-pointer text-left flex flex-col justify-between select-none ${
                                                isSelected
                                                    ? 'bg-pink-50/60 dark:bg-pink-950/30 border border-pink-500/80 shadow-[inset_2px_2px_5px_rgba(236,72,153,0.2),4px_4px_12px_rgba(166,175,195,0.3)] dark:shadow-[inset_2px_2px_5px_rgba(236,72,153,0.3),4px_4px_16px_rgba(0,0,0,0.7)]'
                                                    : 'bg-[#ebf0f7] dark:bg-[#191a24] border border-white/80 dark:border-[#2a2b38] shadow-[4px_4px_12px_rgba(166,175,195,0.35),-4px_-4px_12px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[4px_4px_14px_rgba(0,0,0,0.6),-2px_-2px_8px_rgba(255,255,255,0.02)] hover:shadow-[6px_6px_16px_rgba(166,175,195,0.45),-6px_-6px_16px_rgba(255,255,255,1)] dark:hover:shadow-[6px_6px_18px_rgba(0,0,0,0.7)] hover:border-pink-300 dark:hover:border-pink-800'
                                            }`}
                                        >
                                            {/* Selected Indicator Badge */}
                                            {isSelected && (
                                                <div className="absolute top-3.5 right-3.5 px-2.5 py-0.5 rounded-full bg-pink-500 text-white text-[10px] font-bold tracking-wide flex items-center gap-1 shadow-[2px_2px_5px_rgba(236,72,153,0.4)]">
                                                    <i className="fas fa-check text-[8px]"></i>
                                                    <span>Filtering</span>
                                                </div>
                                            )}

                                            <div>
                                                {/* Top section: Avatar + Name + Role */}
                                                <div className="flex items-start gap-3.5">
                                                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-base font-bold shrink-0 border ${
                                                        isUnassigned
                                                            ? 'bg-[#e4ebf5] dark:bg-[#14151e] border-white/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)]'
                                                            : isSelected
                                                            ? 'bg-pink-500 text-white border-pink-400 shadow-[2px_2px_6px_rgba(236,72,153,0.4)]'
                                                            : 'bg-[#e4ebf5] dark:bg-[#14151e] border-white/80 dark:border-slate-800 text-pink-600 dark:text-pink-400 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)]'
                                                    }`}>
                                                        {isUnassigned ? (
                                                            <i className="fas fa-robot text-sm"></i>
                                                        ) : (
                                                            <i className="fas fa-user-tag text-sm"></i>
                                                        )}
                                                    </div>

                                                    <div className="min-w-0 flex-1 pr-16">
                                                        <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
                                                            {scanner.name || 'Unknown'}
                                                        </h4>
                                                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                                            {scanner.email || (isUnassigned ? 'Legacy scans without user ID' : (scanner.name === 'Unknown' ? 'User profile not found' : 'Operator'))}
                                                        </p>
                                                        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-lg bg-[#e4ebf5] dark:bg-[#14151e] text-slate-700 dark:text-slate-300 border border-white/80 dark:border-slate-800 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)] dark:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5)]">
                                                                <i className="fas fa-id-badge mr-1 text-slate-400"></i>
                                                                {scanner.role || 'Unknown'}
                                                            </span>
                                                            {scanner.last_scanned_at && (
                                                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                                                                    Last: {new Date(scanner.last_scanned_at).toLocaleDateString()}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Scan Count & Progress Bar */}
                                                <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/80">
                                                    <div className="flex items-center justify-between text-xs mb-1.5">
                                                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                                            Scanned Parcels
                                                        </span>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-sm font-extrabold text-pink-600 dark:text-pink-400">
                                                                {scanner.scanned_count}
                                                            </span>
                                                            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                                                                ({percentage}%)
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="w-full bg-[#e4ebf5] dark:bg-[#14151e] h-2.5 rounded-full overflow-hidden p-0.5 border border-white/80 dark:border-slate-800/80 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)]">
                                                        <div
                                                            className="h-full bg-pink-500 rounded-full transition-all duration-300 shadow-[1px_1px_3px_rgba(236,72,153,0.4)]"
                                                            style={{ width: `${Math.max(4, percentage)}%` }}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Status Breakdown Pills */}
                                                {statuses.length > 0 && (
                                                    <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                                                        {statuses.map(([statusKey, count]) => (
                                                            <span
                                                                key={statusKey}
                                                                className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-[#e4ebf5] dark:bg-[#14151e] text-slate-700 dark:text-slate-300 border border-white/80 dark:border-slate-800 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)] dark:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5)] flex items-center gap-1"
                                                            >
                                                                <span className="capitalize text-slate-500 dark:text-slate-400">{statusKey.replace(/_/g, ' ')}:</span>
                                                                <strong className="font-extrabold text-slate-800 dark:text-slate-200">{count}</strong>
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Action prompt footer */}
                                            <div className="mt-4 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between text-[11px] font-bold text-pink-600 dark:text-pink-400 group-hover:translate-x-0.5 transition-transform">
                                                <span>{isSelected ? 'Click to re-filter' : 'Filter by this scanner'}</span>
                                                <i className="fas fa-arrow-right text-[10px]"></i>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Modal Footer */}
                    <div className="flex items-center justify-between p-4 border-t border-slate-200/60 dark:border-slate-800/80 bg-[#ebf0f7]/80 dark:bg-[#14151e]/80 backdrop-blur-md shrink-0">
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                            Showing <strong className="text-slate-800 dark:text-slate-200">{filteredScanners.length}</strong> of {scanners.length} scanners
                        </div>
                        <div className="flex items-center gap-2">
                            {selectedScannerId && (
                                <AppButton
                                    type="button"
                                    variant="neutral"
                                    size="sm"
                                    onClick={handleClearSelection}
                                >
                                    <i className="fas fa-rotate-left text-xs"></i>
                                    <span>Reset Filter</span>
                                </AppButton>
                            )}
                            <AppButton
                                type="button"
                                variant="primary"
                                size="sm"
                                onClick={onClose}
                            >
                                <i className="fas fa-check text-xs"></i>
                                <span>Done</span>
                            </AppButton>
                        </div>
                    </div>
                </div>
            </div>
        </Portal>
    );
}
