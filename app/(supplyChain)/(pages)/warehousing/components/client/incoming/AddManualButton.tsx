"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { addManualParcel } from "@/app/(supplyChain)/(pages)/warehousing/actions/incoming/addManual";
import { getActiveCouriers, Courier } from "@/app/(supplyChain)/(pages)/warehousing/actions/incoming/couriers";
import { sanitizeBarcode, sanitizeSearch } from "@/app/(supplyChain)/components/global/sanitize";
import { philippineLocations } from "@/app/(supplyChain)/lib/regionDataSet";
import Portal from "@/app/(supplyChain)/components/client/Portal";

interface AddManualButtonProps {
    onAdd?: () => void;
}

export default function AddManualButton({ onAdd }: AddManualButtonProps) {
    const [isAdding, setIsAdding] = useState(false);
    const [showModal, setShowModal] = useState(false);

    const handleAddManual = async (data: {
        barcode: string;
        sender_name?: string;
        address: string;
        city: string;
        province: string;
        region: string;
        courier_id?: number;
        customer_name?: string;
        customer_number?: string;
    }) => {
        if (isAdding) return;

        setIsAdding(true);
        const toastId = toast.loading('Adding parcel manually...');

        try {
            const combinedDestination = `${data.address}, ${data.city}, ${data.province}`;

            const payload = {
                barcode: data.barcode,
                sender_name: data.sender_name,
                destination: combinedDestination,
                region: data.region,
                city: data.city,
                province: data.province,
                courier_id: data.courier_id ? Number(data.courier_id) : undefined,
                customer_name: data.customer_name,
                customer_number: data.customer_number,
            };

            const result = await addManualParcel(payload);

            if (!result.success) {
                toast.error(result.error || 'Failed to add parcel', {
                    id: toastId,
                    duration: 5000,
                });
                return;
            }

            toast.success(`Parcel added! Tracking: ${result.data?.trackingNumber}`, {
                id: toastId,
                duration: 3000,
            });

            setShowModal(false);
            onAdd?.();
        } catch (error) {
            toast.error('Failed to add parcel', {
                id: toastId,
                description: error instanceof Error ? error.message : 'Please try again',
                duration: 5000,
            });
        } finally {
            setIsAdding(false);
        }
    };

    return (
        <>
            <button
                type="button"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-semibold text-xs transition-all shadow-sm active:scale-[0.98] cursor-pointer"
                onClick={() => setShowModal(true)}
            >
                <i className="fas fa-plus text-xs" aria-hidden="true" />
                <span>Add Manual</span>
            </button>

            {showModal && (
                <Portal>
                    <ManualEntryModal
                        onClose={() => setShowModal(false)}
                        onSubmit={handleAddManual}
                        isLoading={isAdding}
                    />
                </Portal>
            )}
        </>
    );
}

function ManualEntryModal({
    onClose,
    onSubmit,
    isLoading
}: {
    onClose: () => void;
    onSubmit: (data: {
        barcode: string;
        sender_name?: string;
        address: string;
        city: string;
        province: string;
        region: string;
        courier_id?: number;
        customer_name?: string;
        customer_number?: string;
    }) => void;
    isLoading: boolean;
}) {
    const [formData, setFormData] = useState({
        barcode: "",
        sender_name: "",
        address: "",
        city: "",
        province: "",
        region: "",
        courier_id: "",
        customer_name: "",
        customer_number: "",
    });
    const [couriers, setCouriers] = useState<Courier[]>([]);
    const [loadingCouriers, setLoadingCouriers] = useState(true);
    const [filteredCities, setFilteredCities] = useState<typeof philippineLocations>([]);
    const [filteredProvinces, setFilteredProvinces] = useState<typeof philippineLocations>([]);
    const [showCitySuggestions, setShowCitySuggestions] = useState(false);
    const [showProvinceSuggestions, setShowProvinceSuggestions] = useState(false);

    useEffect(() => {
        const fetchCouriers = async () => {
            try {
                const data = await getActiveCouriers();
                setCouriers(data);
            } catch (error) {
                console.error('Error fetching couriers:', error);
            } finally {
                setLoadingCouriers(false);
            }
        };

        fetchCouriers();
    }, []);

    // City suggestions
    useEffect(() => {
        if (formData.city.length > 1) {
            const filtered = philippineLocations.filter(loc =>
                loc.city.toLowerCase().includes(formData.city.toLowerCase())
            );
            setFilteredCities(filtered);
            setShowCitySuggestions(filtered.length > 0);

            const exactMatch = philippineLocations.find(loc =>
                loc.city.toLowerCase() === formData.city.toLowerCase()
            );
            if (exactMatch) {
                setFormData(prev => ({
                    ...prev,
                    province: exactMatch.province,
                    region: exactMatch.region
                }));
            }
        } else {
            setFilteredCities([]);
            setShowCitySuggestions(false);
            if (!formData.city) {
                setFormData(prev => ({
                    ...prev,
                    province: "",
                    region: ""
                }));
            }
        }
    }, [formData.city]);

    // Province suggestions
    useEffect(() => {
        if (formData.province.length > 1) {
            const filtered = philippineLocations.filter(loc =>
                loc.province.toLowerCase().includes(formData.province.toLowerCase())
            );
            setFilteredProvinces(filtered);
            setShowProvinceSuggestions(filtered.length > 0);

            const exactMatch = philippineLocations.find(loc =>
                loc.province.toLowerCase() === formData.province.toLowerCase()
            );
            if (exactMatch) {
                setFormData(prev => ({
                    ...prev,
                    region: exactMatch.region
                }));
            }
        } else {
            setFilteredProvinces([]);
            setShowProvinceSuggestions(false);
            if (!formData.province) {
                setFormData(prev => ({
                    ...prev,
                    region: ""
                }));
            }
        }
    }, [formData.province]);

    const handleBarcodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const sanitized = sanitizeBarcode(e.target.value);
        setFormData({ ...formData, barcode: sanitized });
    };

    const handleTextChange = (field: 'sender_name' | 'address' | 'city' | 'province' | 'customer_name') => (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        let value = e.target.value;
        setFormData({ ...formData, [field]: value });
    };

    const handleCustomerNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Only allow digits, max length 11
        const value = e.target.value.replace(/\D/g, '').slice(0, 11);
        setFormData({ ...formData, customer_number: value });
    };

    const handleRegionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value;
        setFormData({ ...formData, region: value });
    };

    const selectCity = (location: typeof philippineLocations[0]) => {
        setFormData({
            ...formData,
            city: location.city,
            province: location.province,
            region: location.region,
        });
        setShowCitySuggestions(false);
        setFilteredCities([]);
    };

    const selectProvince = (location: typeof philippineLocations[0]) => {
        setFormData({
            ...formData,
            province: location.province,
            region: location.region,
        });
        setShowProvinceSuggestions(false);
        setFilteredProvinces([]);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const errors: string[] = [];

        const sanitizedBarcode = sanitizeBarcode(formData.barcode);
        if (!sanitizedBarcode || sanitizedBarcode.trim().length === 0) {
            errors.push('Barcode cannot be empty');
        } else if (sanitizedBarcode.length < 3) {
            errors.push('Barcode must be at least 3 characters');
        }

        const addressTrimmed = formData.address.trim();
        if (!addressTrimmed || addressTrimmed.length === 0) {
            errors.push('Address cannot be empty');
        } else if (formData.address.length > 0 && formData.address.trim().length === 0) {
            errors.push('Address cannot contain only spaces');
        }

        const cityTrimmed = formData.city.trim();
        if (!cityTrimmed || cityTrimmed.length === 0) {
            errors.push('City cannot be empty');
        } else if (formData.city.length > 0 && formData.city.trim().length === 0) {
            errors.push('City cannot contain only spaces');
        }

        const provinceTrimmed = formData.province.trim();
        if (!provinceTrimmed || provinceTrimmed.length === 0) {
            errors.push('Province cannot be empty');
        } else if (formData.province.length > 0 && formData.province.trim().length === 0) {
            errors.push('Province cannot contain only spaces');
        }

        const regionTrimmed = formData.region.trim();
        if (!regionTrimmed || regionTrimmed.length === 0) {
            errors.push('Region cannot be empty');
        } else if (formData.region.length > 0 && formData.region.trim().length === 0) {
            errors.push('Region cannot contain only spaces');
        }

        if (formData.sender_name && formData.sender_name.trim().length === 0) {
            errors.push('Sender name cannot contain only spaces');
        }

        if (formData.customer_name && formData.customer_name.trim().length === 0) {
            errors.push('Customer name cannot contain only spaces');
        }

        // Validate customer number - only digits, max 11
        if (formData.customer_number && !/^\d+$/.test(formData.customer_number)) {
            errors.push('Customer number must contain only digits');
        }
        if (formData.customer_number && formData.customer_number.length > 11) {
            errors.push('Customer number must not exceed 11 digits');
        }

        if (errors.length > 0) {
            errors.forEach(error => toast.warning(error));
            return;
        }

        const sanitizedBarcodeFinal = sanitizeBarcode(formData.barcode);
        const sanitizedAddress = sanitizeSearch(formData.address.trim());
        const sanitizedCity = sanitizeSearch(formData.city.trim());
        const sanitizedProvince = sanitizeSearch(formData.province.trim());
        const sanitizedRegion = sanitizeSearch(formData.region.trim());
        const sanitizedSender = formData.sender_name ? sanitizeSearch(formData.sender_name.trim()) : "";
        const sanitizedCustomerName = formData.customer_name ? sanitizeSearch(formData.customer_name.trim()) : "";
        const sanitizedCustomerNumber = formData.customer_number ? formData.customer_number.trim() : "";

        const courierId = formData.courier_id ? parseInt(formData.courier_id) : undefined;

        onSubmit({
            barcode: sanitizedBarcodeFinal,
            sender_name: sanitizedSender || undefined,
            address: sanitizedAddress,
            city: sanitizedCity,
            province: sanitizedProvince,
            region: sanitizedRegion,
            courier_id: courierId,
            customer_name: sanitizedCustomerName || undefined,
            customer_number: sanitizedCustomerNumber || undefined,
        });
    };

    return (
        <div className="fixed inset-0 bg-slate-900/70 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl dark:shadow-black/70 border border-slate-100 dark:border-slate-800 transform transition-all max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-5">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Add Manual Entry</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Enter details to add a new parcel manually</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-all cursor-pointer"
                        disabled={isLoading}
                        aria-label="Close"
                    >
                        <i className="fas fa-times text-sm"></i>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="flex items-center gap-3 rounded-xl border border-pink-100 dark:border-pink-950/60 bg-pink-50/60 dark:bg-pink-950/20 p-3.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-pink-100 dark:bg-pink-900/40 text-pink-600 dark:text-pink-400">
                            <i className="fas fa-info-circle text-xs"></i>
                        </div>
                        <p className="text-xs font-medium text-pink-950 dark:text-pink-200">
                            Tracking number will be auto-generated upon submission.
                            <br />
                            All fields marked with <span className="text-pink-500 dark:text-pink-400 font-bold">*</span> are required.
                        </p>
                    </div>

                    <div>
                        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                            Barcode <span className="text-pink-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.barcode}
                            onChange={handleBarcodeChange}
                            className={`w-full rounded-xl border bg-slate-50 dark:bg-slate-800/40 px-3.5 py-2.5 font-mono text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:border-pink-500 dark:focus:border-pink-500 focus:outline-none transition-all ${formData.barcode.length > 0 && formData.barcode.trim().length === 0
                                ? 'border-amber-500 dark:border-amber-500/80'
                                : 'border-slate-200 dark:border-slate-700/80'
                                }`}
                            placeholder="Scan or enter barcode"
                            required
                            disabled={isLoading}
                            autoFocus
                            spellCheck={false}
                            autoCorrect="off"
                            autoCapitalize="off"
                            maxLength={50}
                        />
                        {formData.barcode.length > 0 && formData.barcode.trim().length === 0 && (
                            <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                                <i className="fas fa-exclamation-triangle"></i> Cannot contain only spaces
                            </p>
                        )}
                    </div>

                    <div className="space-y-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 p-4">
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            Sender Information
                        </span>

                        <div>
                            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                Sender Name
                            </label>
                            <input
                                type="text"
                                value={formData.sender_name}
                                onChange={handleTextChange('sender_name')}
                                className={`w-full rounded-xl border bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-pink-500 dark:focus:border-pink-500 focus:outline-none transition-all ${formData.sender_name && formData.sender_name.trim().length === 0 ? 'border-amber-500 dark:border-amber-500/80' : 'border-slate-200 dark:border-slate-700/80'
                                    }`}
                                placeholder="Enter sender name (optional)"
                                disabled={isLoading}
                                maxLength={150}
                            />
                        </div>

                        <div>
                            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                Customer Name
                            </label>
                            <input
                                type="text"
                                value={formData.customer_name}
                                onChange={handleTextChange('customer_name')}
                                className={`w-full rounded-xl border bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-pink-500 dark:focus:border-pink-500 focus:outline-none transition-all ${formData.customer_name && formData.customer_name.trim().length === 0 ? 'border-amber-500 dark:border-amber-500/80' : 'border-slate-200 dark:border-slate-700/80'
                                    }`}
                                placeholder="Enter customer name (optional)"
                                disabled={isLoading}
                                maxLength={200}
                            />
                        </div>

                        <div>
                            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                Customer Number <span className="text-amber-500 dark:text-amber-400 text-[10px]">(digits only, max 11)</span>
                            </label>
                            <input
                                type="text"
                                value={formData.customer_number}
                                onChange={handleCustomerNumberChange}
                                className={`w-full rounded-xl border bg-white dark:bg-slate-900 px-3.5 py-2.5 font-mono text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-pink-500 dark:focus:border-pink-500 focus:outline-none transition-all ${formData.customer_number && !/^\d+$/.test(formData.customer_number) ? 'border-amber-500 dark:border-amber-500/80' : 'border-slate-200 dark:border-slate-700/80'
                                    }`}
                                placeholder="Enter customer number (optional)"
                                disabled={isLoading}
                                maxLength={11}
                                inputMode="numeric"
                                pattern="[0-9]*"
                            />
                            {formData.customer_number && !/^\d+$/.test(formData.customer_number) && (
                                <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                                    <i className="fas fa-exclamation-triangle"></i> Only digits are allowed
                                </p>
                            )}
                            {formData.customer_number && /^\d+$/.test(formData.customer_number) && (
                                <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                                    <i className="fas fa-check-circle text-emerald-500 mr-1"></i>
                                    {formData.customer_number.length} / 11 digits
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 p-4">
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            Delivery Destination
                        </span>

                        <div>
                            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                Street Address <span className="text-pink-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.address}
                                onChange={handleTextChange('address')}
                                className={`w-full rounded-xl border bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-pink-500 dark:focus:border-pink-500 focus:outline-none transition-all ${formData.address.length > 0 && formData.address.trim().length === 0 ? 'border-amber-500 dark:border-amber-500/80' : 'border-slate-200 dark:border-slate-700/80'
                                    }`}
                                placeholder="Enter complete street address"
                                required
                                disabled={isLoading}
                                maxLength={200}
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <div className="relative">
                                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                    City <span className="text-pink-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.city}
                                    onChange={handleTextChange('city')}
                                    className={`w-full rounded-xl border bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-pink-500 dark:focus:border-pink-500 focus:outline-none transition-all ${formData.city.length > 0 && formData.city.trim().length === 0 ? 'border-amber-500 dark:border-amber-500/80' : 'border-slate-200 dark:border-slate-700/80'
                                        }`}
                                    placeholder="Enter city"
                                    required
                                    disabled={isLoading}
                                    maxLength={150}
                                    onFocus={() => formData.city.length > 1 && setShowCitySuggestions(true)}
                                    onBlur={() => setTimeout(() => setShowCitySuggestions(false), 200)}
                                />
                                {showCitySuggestions && filteredCities.length > 0 && (
                                    <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl">
                                        {filteredCities.map((loc, index) => (
                                            <button
                                                key={index}
                                                type="button"
                                                className="flex w-full flex-col px-4 py-2 text-left text-sm transition-colors hover:bg-pink-50 dark:hover:bg-slate-800 cursor-pointer"
                                                onClick={() => selectCity(loc)}
                                            >
                                                <span className="font-semibold text-slate-800 dark:text-slate-200">{loc.city}</span>
                                                <span className="text-xs text-slate-400 dark:text-slate-500">
                                                    {loc.province} • {loc.region}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                    Province <span className="text-pink-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.province}
                                    onChange={handleTextChange('province')}
                                    className={`w-full rounded-xl border bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-pink-500 dark:focus:border-pink-500 focus:outline-none transition-all ${formData.province.length > 0 && formData.province.trim().length === 0 ? 'border-amber-500 dark:border-amber-500/80' : 'border-slate-200 dark:border-slate-700/80'
                                        }`}
                                    placeholder="Enter province"
                                    required
                                    disabled={isLoading}
                                    maxLength={150}
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                    Region <span className="text-pink-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.region}
                                    onChange={handleRegionChange}
                                    className={`w-full rounded-xl border bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-pink-500 dark:focus:border-pink-500 focus:outline-none transition-all ${formData.region.length > 0 && formData.region.trim().length === 0 ? 'border-amber-500 dark:border-amber-500/80' : 'border-slate-200 dark:border-slate-700/80'
                                        }`}
                                    placeholder="e.g. NCR"
                                    required
                                    disabled={isLoading}
                                    maxLength={100}
                                />
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-2xs">
                            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                Destination Preview
                            </p>
                            <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                {formData.address && formData.city && formData.province ? (
                                    <span className="flex items-center gap-1.5">
                                        <i className="fas fa-map-pin text-pink-500"></i>
                                        {`${formData.address}, ${formData.city}, ${formData.province}${formData.region ? `, ${formData.region}` : ''
                                            }`}
                                    </span>
                                ) : (
                                    <span className="text-slate-400 dark:text-slate-500 italic">Complete address, city, and province to preview...</span>
                                )}
                            </p>
                        </div>
                    </div>

                    <div>
                        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                            Courier
                        </label>
                        <select
                            value={formData.courier_id}
                            onChange={(e) => setFormData({ ...formData, courier_id: e.target.value })}
                            className="w-full cursor-pointer rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:border-pink-500 dark:focus:border-pink-500 focus:outline-none transition-all"
                            disabled={isLoading || loadingCouriers}
                        >
                            <option value="" className="dark:bg-slate-900">Select courier</option>
                            {loadingCouriers ? (
                                <option value="" disabled className="dark:bg-slate-900">Loading couriers...</option>
                            ) : couriers.length === 0 ? (
                                <option value="" disabled className="dark:bg-slate-900">No couriers found</option>
                            ) : (
                                couriers.map((courier) => (
                                    <option key={courier.id} value={courier.id} className="dark:bg-slate-900">
                                        {courier.code} - {courier.name}
                                    </option>
                                ))
                            )}
                        </select>
                    </div>

                    <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 transition-all hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 active:scale-[0.98] cursor-pointer"
                            disabled={isLoading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-pink-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-pink-500 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <i className="fas fa-spinner fa-spin"></i>
                                    <span>Adding...</span>
                                </>
                            ) : (
                                <span>Add Parcel</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}