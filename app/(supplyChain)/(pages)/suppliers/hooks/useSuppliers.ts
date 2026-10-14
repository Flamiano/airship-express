// suppliers state management hook and operations

"use client";

import { useEffect, useRef, useState } from "react";
import {
    Chart,
    BarController,
    BarElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend,
    ArcElement,
    DoughnutController,
} from "chart.js";
import { supabase } from "../../../lib/services/client/supabase";
import { toast } from "sonner";
import { useConfirm } from "../../../components/ui/ConfirmModal";
import { sanitizeText } from "../../../components/global/sanitize";
import {
    Supplier,
    PurchaseOrder,
    NewSupplierFormState,
    SelectedChartData,
    SupplierStats,
    ITEMS_PER_PAGE,
    PO_ITEMS_PER_PAGE,
} from "../types";

let isRegistered = false;

export function useSuppliers() {
    const { confirm } = useConfirm();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [potentialCount, setPotentialCount] = useState<number>(0);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [categories, setCategories] = useState<string[]>([]);
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [showNewSupplierModal, setShowNewSupplierModal] = useState(false);
    const [showEditSupplierModal, setShowEditSupplierModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedSuppliers, setSelectedSuppliers] = useState<Set<number>>(new Set());
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [selectedPurchaseOrders, setSelectedPurchaseOrders] = useState<Set<string>>(new Set());
    const [isDeletingPO, setIsDeletingPO] = useState(false);
    const [showActivityDetailModal, setShowActivityDetailModal] = useState(false);
    const [showCategoryDetailModal, setShowCategoryDetailModal] = useState(false);
    const [selectedChartData, setSelectedChartData] = useState<SelectedChartData>({});
    const [currentPOPage, setCurrentPOPage] = useState(1);
    const [currentPage, setCurrentPage] = useState(1);
    const [newSupplier, setNewSupplier] = useState<NewSupplierFormState>({
        name: "",
        category: "",
        contact_person: "",
        phone: "",
        email: "",
        location: "",
        products: "",
        fb_link: "",
        notes: "",
    });

    const [unreadMessageCounts, setUnreadMessageCounts] = useState<Record<number, number>>({});
    const [totalUnreadMessages, setTotalUnreadMessages] = useState<number>(0);

    // po detail modal state
    const [selectedPurchaseOrder, setSelectedPurchaseOrder] = useState<PurchaseOrder | null>(null);
    const [showPurchaseOrderModal, setShowPurchaseOrderModal] = useState(false);

    const activityChartRef = useRef<HTMLCanvasElement>(null);
    const activityChartInstance = useRef<Chart | null>(null);
    const categoryChartRef = useRef<HTMLCanvasElement>(null);
    const categoryChartInstance = useRef<Chart | null>(null);

    // register charts
    useEffect(() => {
        if (!isRegistered) {
            Chart.register(
                BarController,
                BarElement,
                CategoryScale,
                LinearScale,
                Tooltip,
                Legend,
                ArcElement,
                DoughnutController
            );
            isRegistered = true;
        }
    }, []);

    // fetch unread messages sent by suppliers
    const fetchUnreadMessageCounts = async () => {
        try {
            const { data, error } = await supabase
                .from("messages")
                .select("supplier_id")
                .eq("sender_type", "supplier")
                .eq("is_read", false);

            if (error) throw error;

            const counts: Record<number, number> = {};
            let total = 0;
            if (data) {
                data.forEach((m: any) => {
                    if (m.supplier_id) {
                        const sId = Number(m.supplier_id);
                        counts[sId] = (counts[sId] || 0) + 1;
                        total++;
                    }
                });
            }
            setUnreadMessageCounts(counts);
            setTotalUnreadMessages(total);
        } catch (error) {
            console.error("Error fetching unread message counts:", error);
        }
    };

    // Mark unread messages for a specific supplier as read optimistically and in DB
    const markSupplierMessagesAsRead = async (supplierId: number) => {
        setUnreadMessageCounts((prev) => {
            if (!prev[supplierId]) return prev;
            const countToSubtract = prev[supplierId] || 0;
            const next = { ...prev };
            delete next[supplierId];
            setTotalUnreadMessages((t) => Math.max(0, t - countToSubtract));
            return next;
        });

        try {
            await supabase
                .from("messages")
                .update({ is_read: true })
                .eq("supplier_id", supplierId)
                .eq("sender_type", "supplier")
                .eq("is_read", false);
        } catch (err) {
            console.error("Error marking messages as read:", err);
        }
    };

    // fetch initial data and subscribe to message updates
    useEffect(() => {
        fetchSuppliers();
        fetchPurchaseOrders();
        fetchUnreadMessageCounts();

        const channel = supabase
            .channel(`all_suppliers_realtime_channel_${Date.now()}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "messages",
                },
                () => {
                    fetchUnreadMessageCounts();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // reset pagination on search or category filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, categoryFilter]);

    // fetch suppliers list from supabase (active suppliers and potential count)
    const fetchSuppliers = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from("suppliers")
                .select("*")
                .order("name");
            if (error) throw error;
            const allSuppliers = data || [];
            const activeOnly = allSuppliers.filter((s) => s.is_active !== false && (s.status || "").toLowerCase() !== "inactive");
            const potentialOnly = allSuppliers.filter(
                (s) => s.is_active === false || (s.notes && (s.notes.toLowerCase().includes("[manual potential supplier lead]") || s.notes.toLowerCase().includes("[potential supplier lead]")))
            );
            setSuppliers(activeOnly);
            setPotentialCount(potentialOnly.length);
            const uniqueCategories = [...new Set(activeOnly.map((s) => s.category).filter(Boolean))];
            setCategories(uniqueCategories);
        } catch (error) {
            console.error("Error fetching suppliers:", error);
            toast.error("Failed to load suppliers");
        } finally {
            setIsLoading(false);
        }
    };

    // fetch purchase orders from supabase (10 latest)
    const fetchPurchaseOrders = async () => {
        try {
            const { data, error } = await supabase
                .from("purchase_orders")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(10);
            if (error) throw error;
            setPurchaseOrders(data || []);
        } catch (error) {
            console.error("error fetching purchase orders:", error);
        }
    };

    // helper to sanitize email and phone adhering to PostgreSQL check constraints
    const sanitizeSupplierEmail = (emailStr?: string | null) => {
        if (!emailStr || typeof emailStr !== "string") return null;
        const trimmed = emailStr.trim();
        if (!trimmed) return null;
        const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
        return emailRegex.test(trimmed) ? trimmed : null;
    };

    const sanitizeSupplierPhone = (phoneStr?: string | null) => {
        const phoneRegex = /^\+?[0-9\s\-\(\)]{7,20}$/;
        if (!phoneStr || typeof phoneStr !== "string") return "+63 2 8000 0000";
        const cleaned = phoneStr.trim().replace(/[^0-9+\s\-()]/g, "").trim();
        if (cleaned.length >= 7 && cleaned.length <= 20 && phoneRegex.test(cleaned)) {
            return cleaned;
        }
        const digits = phoneStr.replace(/\D/g, "");
        if (digits.length >= 7 && digits.length <= 15) {
            return digits.startsWith("63") ? `+${digits}` : digits.startsWith("0") ? `+63 ${digits.slice(1)}` : `+63 ${digits}`;
        }
        return "+63 2 8000 0000";
    };

    // handle adding a new supplier
    // handle adding a new supplier
    const handleAddSupplier = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = newSupplier.name.trim();
        if (!trimmedName) {
            toast.error("Supplier name is required.");
            return;
        }

        setIsSubmitting(true);
        try {
            // Check for duplicate supplier name
            const { data: existingSuppliers } = await supabase
                .from("suppliers")
                .select("id, name, is_active")
                .ilike("name", trimmedName)
                .limit(1);

            if (existingSuppliers && existingSuppliers.length > 0) {
                const ex = existingSuppliers[0];
                toast.error(`Duplicate Supplier: "${ex.name}" already exists in ${ex.is_active ? "Registered Suppliers" : "Potential Suppliers"}.`);
                setIsSubmitting(false);
                return;
            }

            const { data, error } = await supabase
                .from("suppliers")
                .insert({
                    name: trimmedName,
                    category: newSupplier.category || "General Supplies",
                    contact_person: newSupplier.contact_person?.trim() || "Store Contact",
                    phone: sanitizeSupplierPhone(newSupplier.phone),
                    email: sanitizeSupplierEmail(newSupplier.email),
                    location: newSupplier.location || "Metro Manila, Philippines",
                    products: newSupplier.products || "",
                    notes: newSupplier.notes || "",
                    fb_link: newSupplier.fb_link || "",
                    is_active: true,
                })
                .select()
                .single();
            if (error) throw error;
            toast.success(`Supplier "${data.name}" added successfully!`);
            setShowNewSupplierModal(false);
            setNewSupplier({
                name: "",
                category: "",
                contact_person: "",
                phone: "",
                email: "",
                location: "",
                products: "",
                fb_link: "",
                notes: "",
            });
            fetchSuppliers();
        } catch (error: any) {
            console.error("Error adding supplier:", error);
            toast.error(error.message || "Failed to add supplier");
        } finally {
            setIsSubmitting(false);
        }
    };

    // handle updating an existing supplier
    const handleUpdateSupplier = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingSupplier) return;
        const trimmedName = editingSupplier.name.trim();
        if (!trimmedName) {
            toast.error("Supplier name is required.");
            return;
        }

        setIsSubmitting(true);
        try {
            // Check for duplicate supplier name on other records
            const { data: existingSuppliers } = await supabase
                .from("suppliers")
                .select("id, name")
                .ilike("name", trimmedName)
                .neq("id", editingSupplier.id)
                .limit(1);

            if (existingSuppliers && existingSuppliers.length > 0) {
                toast.error(`Duplicate Name: Another supplier with name "${existingSuppliers[0].name}" already exists.`);
                setIsSubmitting(false);
                return;
            }

            const updatePayload: any = {
                name: trimmedName,
                category: editingSupplier.category || "General Supplies",
                contact_person: editingSupplier.contact_person?.trim() || "Store Contact",
                phone: sanitizeSupplierPhone(editingSupplier.phone),
                email: sanitizeSupplierEmail(editingSupplier.email),
                location: editingSupplier.location || "Metro Manila, Philippines",
                products: editingSupplier.products || "",
                notes: editingSupplier.notes || "",
                fb_link: editingSupplier.fb_link || "",
                is_active: editingSupplier.is_active,
                updated_at: new Date().toISOString(),
            };

            if (editingSupplier.payment_terms !== undefined) updatePayload.payment_terms = editingSupplier.payment_terms;
            if (editingSupplier.payment_method !== undefined) updatePayload.payment_method = editingSupplier.payment_method;
            if (editingSupplier.delivery_terms !== undefined) updatePayload.delivery_terms = editingSupplier.delivery_terms;
            if (editingSupplier.warranty !== undefined) updatePayload.warranty = editingSupplier.warranty;
            if (editingSupplier.lead_time !== undefined) updatePayload.lead_time = editingSupplier.lead_time;
            if (editingSupplier.moq !== undefined) updatePayload.moq = editingSupplier.moq;
            if (editingSupplier.return_policy !== undefined) updatePayload.return_policy = editingSupplier.return_policy;
            if (editingSupplier.terms_and_conditions !== undefined) updatePayload.terms_and_conditions = editingSupplier.terms_and_conditions;
            if (editingSupplier.tin !== undefined) updatePayload.tin = editingSupplier.tin;
            if (editingSupplier.tax_id !== undefined) updatePayload.tax_id = editingSupplier.tax_id;
            if (editingSupplier.tax_type !== undefined) updatePayload.tax_type = editingSupplier.tax_type;
            if (editingSupplier.bank_name !== undefined) updatePayload.bank_name = editingSupplier.bank_name;
            if (editingSupplier.bank_account_name !== undefined) updatePayload.bank_account_name = editingSupplier.bank_account_name;
            if (editingSupplier.bank_account_number !== undefined) updatePayload.bank_account_number = editingSupplier.bank_account_number;
            if (editingSupplier.other_products_offer !== undefined) {
                updatePayload.other_products_offer = Array.isArray(editingSupplier.other_products_offer) 
                    ? editingSupplier.other_products_offer 
                    : [];
            }

            const { error } = await supabase
                .from("suppliers")
                .update(updatePayload)
                .eq("id", editingSupplier.id);
            if (error) throw error;
            toast.success(`Supplier "${editingSupplier.name}" updated successfully!`);
            setShowEditSupplierModal(false);
            setEditingSupplier(null);
            fetchSuppliers();
        } catch (error: any) {
            console.error("Error updating supplier:", error);
            toast.error(error.message || "Failed to update supplier");
        } finally {
            setIsSubmitting(false);
        }
    };

    // handle deactivating a single supplier (soft deactivation preserves contracts, documents, and history)
    const handleDeleteSupplier = async (supplierId: number, supplierName: string) => {
        const confirmed = await confirm({
            title: "Deactivate Supplier",
            message: `Are you sure you want to deactivate "${supplierName}"? This will hide the supplier from active directories while preserving all contracts, documents, quotations, and transaction history.`,
            confirmText: "Deactivate",
            cancelText: "Cancel",
            confirmVariant: "danger",
        });
        if (!confirmed) return;
        try {
            const { error } = await supabase
                .from("suppliers")
                .update({ is_active: false, status: "inactive" })
                .eq("id", supplierId);
            if (error) throw error;
            toast.success(`Supplier "${supplierName}" deactivated successfully (documents and history preserved)!`);
            fetchSuppliers();
            setShowModal(false);
        } catch (error: any) {
            console.error("Error deactivating supplier:", error);
            toast.error(error.message || "Failed to deactivate supplier");
        }
    };

    // handle bulk deactivating selected suppliers
    const handleBulkDelete = async () => {
        if (selectedSuppliers.size === 0) {
            toast.warning("Please select at least one supplier");
            return;
        }
        const confirmed = await confirm({
            title: "Deactivate Selected Suppliers",
            message: `Are you sure you want to deactivate ${selectedSuppliers.size} selected supplier(s)? This preserves all related documents, quotations, and historical records.`,
            confirmText: "Deactivate All",
            cancelText: "Cancel",
            confirmVariant: "danger",
        });
        if (!confirmed) return;
        try {
            const { error } = await supabase
                .from("suppliers")
                .update({ is_active: false, status: "inactive" })
                .in("id", Array.from(selectedSuppliers));
            if (error) throw error;
            toast.success(`${selectedSuppliers.size} supplier(s) deactivated successfully!`);
            setSelectedSuppliers(new Set());
            fetchSuppliers();
        } catch (error: any) {
            console.error("Error bulk deactivating suppliers:", error);
            toast.error(error.message || "Failed to deactivate suppliers");
        }
    };

    // handle deleting a purchase order
    const handleDeletePurchaseOrder = async (poId: string, poNumber: string) => {
        const confirmed = await confirm({
            title: "Delete Purchase Order",
            message: `Are you sure you want to delete PO "${poNumber}"? This action cannot be undone.`,
            confirmText: "Delete",
            cancelText: "Cancel",
            confirmVariant: "danger",
        });
        if (!confirmed) return;
        try {
            const { error } = await supabase
                .from("purchase_orders")
                .delete()
                .eq("id", poId);
            if (error) throw error;
            toast.success(`PO "${poNumber}" deleted successfully!`);
            fetchPurchaseOrders();
            fetchSuppliers();
        } catch (error: any) {
            console.error("Error deleting purchase order:", error);
            toast.error(error.message || "Failed to delete purchase order");
        }
    };

    // handle bulk deleting selected purchase orders
    const handleBulkDeletePurchaseOrders = async () => {
        if (selectedPurchaseOrders.size === 0) {
            toast.warning("Please select at least one purchase order to delete");
            return;
        }
        const confirmed = await confirm({
            title: "Delete Selected Purchase Orders",
            message: `Are you sure you want to delete ${selectedPurchaseOrders.size} selected purchase order(s)? This action cannot be undone.`,
            confirmText: `Delete ${selectedPurchaseOrders.size}`,
            cancelText: "Cancel",
            confirmVariant: "danger",
        });
        if (!confirmed) return;
        try {
            const { error } = await supabase
                .from("purchase_orders")
                .delete()
                .in("id", Array.from(selectedPurchaseOrders));
            if (error) throw error;
            toast.success(`${selectedPurchaseOrders.size} purchase order(s) deleted successfully!`);
            setSelectedPurchaseOrders(new Set());
            fetchPurchaseOrders();
            fetchSuppliers();
        } catch (error: any) {
            console.error("Error bulk deleting purchase orders:", error);
            toast.error(error.message || "Failed to delete purchase orders");
        }
    };

    // handle selection toggle for a single po
    const handleToggleSelectPO = (poId: string) => {
        const newSelected = new Set(selectedPurchaseOrders);
        if (newSelected.has(poId)) {
            newSelected.delete(poId);
        } else {
            newSelected.add(poId);
        }
        setSelectedPurchaseOrders(newSelected);
    };

    // handle select all toggle for purchase orders
    const handleSelectAllPO = () => {
        if (selectedPurchaseOrders.size === paginatedPurchaseOrders.length) {
            setSelectedPurchaseOrders(new Set());
        } else {
            setSelectedPurchaseOrders(new Set(paginatedPurchaseOrders.map((po) => po.id)));
        }
    };

    // handle selection toggle for a single supplier
    const handleToggleSelect = (supplierId: number) => {
        const newSelected = new Set(selectedSuppliers);
        if (newSelected.has(supplierId)) {
            newSelected.delete(supplierId);
        } else {
            newSelected.add(supplierId);
        }
        setSelectedSuppliers(newSelected);
    };

    // handle select all toggle for suppliers
    const handleSelectAll = () => {
        if (selectedSuppliers.size === filteredSuppliers.length) {
            setSelectedSuppliers(new Set());
        } else {
            setSelectedSuppliers(new Set(filteredSuppliers.map((s) => s.id)));
        }
    };

    // handle toggling supplier active status
    const handleToggleActive = async (supplierId: number, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from("suppliers")
                .update({
                    is_active: !currentStatus,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", supplierId);
            if (error) throw error;
            toast.success(`Supplier ${!currentStatus ? 'activated' : 'deactivated'} successfully!`);
            fetchSuppliers();
        } catch (error: any) {
            console.error("Error toggling supplier status:", error);
            toast.error(error.message || "Failed to update supplier status");
        }
    };

    // view purchase order details modal
    const handleViewPurchaseOrder = (order: PurchaseOrder) => {
        setSelectedPurchaseOrder(order);
        setShowPurchaseOrderModal(true);
    };

    // computed filtered suppliers (active suppliers only)
    const filteredSuppliers = suppliers.filter((supplier) => {
        if (supplier.is_active === false) return false;
        const matchesSearch =
            supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            supplier.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            supplier.email?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = !categoryFilter || supplier.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    const totalPages = Math.max(1, Math.ceil(filteredSuppliers.length / ITEMS_PER_PAGE));
    const paginatedSuppliers = filteredSuppliers.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );
    const activeSuppliers = suppliers.filter((s) => s.is_active).length;

    // pagination for purchase orders
    const paginatedPurchaseOrders = purchaseOrders.slice(
        (currentPOPage - 1) * PO_ITEMS_PER_PAGE,
        currentPOPage * PO_ITEMS_PER_PAGE
    );
    const POTotalPages = Math.max(1, Math.ceil(purchaseOrders.length / PO_ITEMS_PER_PAGE));

    // calculate spending and order stats per supplier
    const supplierOrderCounts = suppliers.map((s) => {
        const supplierOrders = purchaseOrders.filter((po) => po.supplier_id === s.id);
        const paidOrders = purchaseOrders.filter((po) => po.supplier_id === s.id && po.paid === true);
        return {
            ...s,
            orderCount: supplierOrders.length,
            totalSpent: paidOrders.reduce((sum, po) => sum + (po.total_amount || 0), 0),
        };
    });

    const topSupplier =
        supplierOrderCounts.length > 0
            ? supplierOrderCounts.reduce((a, b) => (a.orderCount > b.orderCount ? a : b))
            : null;

    const categoryCount = suppliers.reduce((acc: Record<string, number>, s) => {
        acc[s.category] = (acc[s.category] || 0) + 1;
        return acc;
    }, {});

    const topCategory = Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

    const statusCounts = purchaseOrders.reduce((acc, po) => {
        acc[po.status] = (acc[po.status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const supplierStats: SupplierStats = {
        totalOrders: purchaseOrders.length,
        totalSpent: purchaseOrders.reduce((sum, po) => sum + (po.total_amount || 0), 0),
        topSupplierName: topSupplier?.name || "N/A",
        topSupplierOrders: topSupplier?.orderCount || 0,
        statusCounts,
    };

    // create purchase activity bar chart
    const createActivityChart = () => {
        if (activityChartInstance.current) {
            activityChartInstance.current.destroy();
            activityChartInstance.current = null;
        }
        const canvas = activityChartRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        if (suppliers.length === 0 || purchaseOrders.length === 0) return;

        // get top 5
        const supplierCounts = suppliers.map((s) => {
            const supplierOrders = purchaseOrders.filter((po) => po.supplier_id === s.id);
            const paidOrders = purchaseOrders.filter((po) => po.supplier_id === s.id && po.paid === true);
            return {
                ...s,
                orderCount: supplierOrders.length,
                totalSpent: paidOrders.reduce((sum, po) => sum + (po.total_amount || 0), 0),
            };
        });

        const topSuppliers = [...supplierCounts]
            .sort((a, b) => b.orderCount - a.orderCount)
            .slice(0, 5);

        const displaySuppliers = topSuppliers.some((s) => s.orderCount > 0)
            ? topSuppliers
            : suppliers.slice(0, 5).map((s) => ({
                  ...s,
                  orderCount: 0,
                  totalSpent: 0,
              }));

        const orderCounts = displaySuppliers.map((s) => s.orderCount);
        const spendingData = displaySuppliers.map((s) => s.totalSpent / 1000);

        activityChartInstance.current = new Chart(ctx, {
            type: "bar",
            data: {
                labels: displaySuppliers.map((s) =>
                    s.name.length > 12 ? s.name.substring(0, 12) + "..." : s.name
                ),
                datasets: [
                    {
                        label: "Orders",
                        data: orderCounts,
                        backgroundColor: "#EC4899",
                        borderRadius: 8,
                        barThickness: 28,
                        order: 1,
                    },
                    {
                        label: "Paid (K)",
                        data: spendingData,
                        backgroundColor: "#F472B6",
                        borderRadius: 8,
                        barThickness: 28,
                        order: 2,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "top",
                        labels: {
                            boxWidth: 12,
                            boxHeight: 12,
                            usePointStyle: true,
                            font: { size: 10, weight: 500 },
                            padding: 16,
                            color: "#64748b",
                        },
                    },
                    tooltip: {
                        backgroundColor: "#1e293b",
                        titleColor: "#f1f5f9",
                        bodyColor: "#cbd5e1",
                        borderColor: "#334155",
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: function (context) {
                                let label = context.dataset.label || "";
                                let value = context.parsed.y || 0;
                                if (context.dataset.label === "Paid (K)") {
                                    return `${label}: ${(value * 1000).toLocaleString()}`;
                                }
                                return `${label}: ${value}`;
                            },
                        },
                    },
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            font: { size: 10 },
                            maxRotation: 35,
                            minRotation: 0,
                            color: "#94a3b8",
                        },
                    },
                    y: {
                        grid: { color: "#f1f5f9" },
                        beginAtZero: true,
                        ticks: {
                            font: { size: 10 },
                            color: "#94a3b8",
                            stepSize: Math.max(
                                1,
                                Math.ceil(Math.max(...orderCounts, ...spendingData) / 5)
                            ),
                        },
                    },
                },
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const element = elements[0];
                        const index = element.index;
                        const supplier = displaySuppliers[index];
                        if (supplier) {
                            const allOrders = purchaseOrders.filter(
                                (po) => po.supplier_id === supplier.id
                            );
                            const paidOrders = purchaseOrders.filter(
                                (po) => po.supplier_id === supplier.id && po.paid === true
                            );
                            setSelectedChartData({
                                supplierName: supplier.name,
                                orderCount: allOrders.length,
                                totalSpent: paidOrders.reduce(
                                    (sum, po) => sum + (po.total_amount || 0),
                                    0
                                ),
                            });
                            setShowActivityDetailModal(true);
                        }
                    }
                },
            },
        });
    };

    // create supplier categories doughnut chart
    const createCategoryChart = () => {
        if (categoryChartInstance.current) {
            categoryChartInstance.current.destroy();
            categoryChartInstance.current = null;
        }
        const canvas = categoryChartRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        if (suppliers.length === 0) return;

        const categoryData = suppliers.reduce((acc: Record<string, number>, s) => {
            const cat = (s.category && s.category.trim()) ? s.category.trim() : "Uncategorized";
            acc[cat] = (acc[cat] || 0) + 1;
            return acc;
        }, {});

        const colors = [
            "#EC4899", "#F472B6", "#F9A8D4", "#FBCFE8",
            "#8B5CF6", "#A78BFA", "#C4B5FD",
            "#6366F1", "#818CF8", "#A5B4FC"
        ];
        const entries = Object.entries(categoryData).sort((a, b) => b[1] - a[1]);
        const labels = entries.map((e) => e[0]);
        const data = entries.map((e) => e[1]);

        categoryChartInstance.current = new Chart(ctx, {
            type: "doughnut",
            data: {
                labels: labels,
                datasets: [
                    {
                        data: data,
                        backgroundColor: colors.slice(0, labels.length),
                        borderWidth: 2,
                        borderColor: "#ffffff",
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "65%",
                plugins: {
                    legend: {
                        position: "right",
                        labels: {
                            boxWidth: 10,
                            boxHeight: 10,
                            usePointStyle: true,
                            font: { size: 10, weight: 500 },
                            padding: 12,
                            color: "#64748b",
                        },
                    },
                    tooltip: {
                        backgroundColor: "#1e293b",
                        titleColor: "#f1f5f9",
                        bodyColor: "#cbd5e1",
                        borderColor: "#334155",
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: function (context) {
                                const total = context.dataset.data.reduce(
                                    (a: number, b: number) => a + b,
                                    0
                                );
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: ${context.parsed} (${percentage}%)`;
                            },
                        },
                    },
                },
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const element = elements[0];
                        const index = element.index;
                        const category = labels[index];
                        if (category) {
                            const suppliersInCategory = suppliers.filter(
                                (s) => (s.category?.trim() || "Uncategorized") === category
                            );
                            setSelectedChartData({
                                category: category,
                                suppliers: suppliersInCategory,
                            });
                            setShowCategoryDetailModal(true);
                        }
                    }
                },
            },
        });
    };

    // manually trigger redrawing of charts (e.g. when tab switches back to registered)
    const redrawCharts = () => {
        setTimeout(() => {
            if (activityChartRef.current) {
                createActivityChart();
            }
            if (categoryChartRef.current) {
                createCategoryChart();
            }
        }, 100);
    };

    // initialize and redraw charts when data updates
    useEffect(() => {
        if (isLoading) return;
        const timer = setTimeout(() => {
            if (activityChartRef.current) {
                createActivityChart();
            }
            if (categoryChartRef.current) {
                createCategoryChart();
            }
        }, 150);
        return () => clearTimeout(timer);
    }, [suppliers, purchaseOrders, isLoading]);

    // handle window resize
    useEffect(() => {
        const handleResize = () => {
            if (activityChartInstance.current) {
                activityChartInstance.current.resize();
            }
            if (categoryChartInstance.current) {
                categoryChartInstance.current.resize();
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // cleanup charts on unmount
    useEffect(() => {
        return () => {
            if (activityChartInstance.current) {
                activityChartInstance.current.destroy();
                activityChartInstance.current = null;
            }
            if (categoryChartInstance.current) {
                categoryChartInstance.current.destroy();
                categoryChartInstance.current = null;
            }
        };
    }, []);

    return {
        suppliers,
        potentialCount,
        purchaseOrders,
        isLoading,
        setIsLoading,
        searchTerm,
        setSearchTerm,
        categoryFilter,
        setCategoryFilter,
        categories,
        selectedSupplier,
        setSelectedSupplier,
        showModal,
        setShowModal,
        showNewSupplierModal,
        setShowNewSupplierModal,
        showEditSupplierModal,
        setShowEditSupplierModal,
        isSubmitting,
        selectedSuppliers,
        setSelectedSuppliers,
        editingSupplier,
        setEditingSupplier,
        selectedPurchaseOrders,
        setSelectedPurchaseOrders,
        isDeletingPO,
        showActivityDetailModal,
        setShowActivityDetailModal,
        showCategoryDetailModal,
        setShowCategoryDetailModal,
        selectedChartData,
        currentPOPage,
        setCurrentPOPage,
        currentPage,
        setCurrentPage,
        newSupplier,
        setNewSupplier,
        selectedPurchaseOrder,
        setSelectedPurchaseOrder,
        showPurchaseOrderModal,
        setShowPurchaseOrderModal,
        activityChartRef,
        categoryChartRef,
        filteredSuppliers,
        totalPages,
        paginatedSuppliers,
        activeSuppliers,
        paginatedPurchaseOrders,
        POTotalPages,
        topSupplier,
        topCategory,
        supplierStats,
        unreadMessageCounts,
        totalUnreadMessages,
        markSupplierMessagesAsRead,
        fetchUnreadMessageCounts,
        fetchSuppliers,
        fetchPurchaseOrders,
        redrawCharts,
        handleAddSupplier,
        handleUpdateSupplier,
        handleDeleteSupplier,
        handleBulkDelete,
        handleDeletePurchaseOrder,
        handleBulkDeletePurchaseOrders,
        handleToggleSelectPO,
        handleSelectAllPO,
        handleToggleSelect,
        handleSelectAll,
        handleToggleActive,
        handleViewPurchaseOrder,
    };
}
