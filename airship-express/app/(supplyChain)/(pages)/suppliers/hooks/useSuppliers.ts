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

    // fetch initial data
    useEffect(() => {
        fetchSuppliers();
        fetchPurchaseOrders();
    }, []);

    // reset pagination on search or category filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, categoryFilter]);

    // fetch suppliers list from supabase
    const fetchSuppliers = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from("suppliers")
                .select("*")
                .order("name");
            if (error) throw error;
            setSuppliers(data || []);
            const uniqueCategories = [...new Set(data?.map((s) => s.category).filter(Boolean))];
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

    // handle adding a new supplier
    const handleAddSupplier = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const { data, error } = await supabase
                .from("suppliers")
                .insert({
                    name: newSupplier.name,
                    category: newSupplier.category,
                    contact_person: newSupplier.contact_person,
                    phone: newSupplier.phone,
                    email: newSupplier.email,
                    location: newSupplier.location,
                    products: newSupplier.products,
                    notes: newSupplier.notes,
                    fb_link: newSupplier.fb_link,
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
        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from("suppliers")
                .update({
                    name: editingSupplier.name,
                    category: editingSupplier.category,
                    contact_person: editingSupplier.contact_person,
                    phone: editingSupplier.phone,
                    email: editingSupplier.email,
                    location: editingSupplier.location,
                    products: editingSupplier.products,
                    notes: editingSupplier.notes,
                    fb_link: editingSupplier.fb_link,
                    is_active: editingSupplier.is_active,
                    updated_at: new Date().toISOString(),
                })
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

    // handle deleting a single supplier
    const handleDeleteSupplier = async (supplierId: number, supplierName: string) => {
        const confirmed = await confirm({
            title: "Delete Supplier",
            message: `Are you sure you want to delete "${supplierName}"? This action cannot be undone.`,
            confirmText: "Delete",
            cancelText: "Cancel",
            confirmVariant: "danger",
        });
        if (!confirmed) return;
        try {
            const { error } = await supabase
                .from("suppliers")
                .delete()
                .eq("id", supplierId);
            if (error) throw error;
            toast.success(`Supplier "${supplierName}" deleted successfully!`);
            fetchSuppliers();
            setShowModal(false);
        } catch (error: any) {
            console.error("Error deleting supplier:", error);
            toast.error(error.message || "Failed to delete supplier");
        }
    };

    // handle bulk deleting selected suppliers
    const handleBulkDelete = async () => {
        if (selectedSuppliers.size === 0) {
            toast.warning("Please select at least one supplier");
            return;
        }
        const confirmed = await confirm({
            title: "Delete Selected Suppliers",
            message: `Are you sure you want to delete ${selectedSuppliers.size} selected supplier(s)? This action cannot be undone.`,
            confirmText: "Delete All",
            cancelText: "Cancel",
            confirmVariant: "danger",
        });
        if (!confirmed) return;
        try {
            const { error } = await supabase
                .from("suppliers")
                .delete()
                .in("id", Array.from(selectedSuppliers));
            if (error) throw error;
            toast.success(`${selectedSuppliers.size} supplier(s) deleted successfully!`);
            setSelectedSuppliers(new Set());
            fetchSuppliers();
        } catch (error: any) {
            console.error("Error bulk deleting suppliers:", error);
            toast.error(error.message || "Failed to delete suppliers");
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

    // computed filtered suppliers
    const filteredSuppliers = suppliers.filter((supplier) => {
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
            acc[s.category] = (acc[s.category] || 0) + 1;
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
                                (s) => s.category === category
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

    // initialize and redraw charts when data updates
    useEffect(() => {
        if (isLoading) return;
        const timer = setTimeout(() => {
            if (activityChartRef.current && categoryChartRef.current) {
                createActivityChart();
                createCategoryChart();
            }
        }, 500);
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
        purchaseOrders,
        isLoading,
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
        fetchSuppliers,
        fetchPurchaseOrders,
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
