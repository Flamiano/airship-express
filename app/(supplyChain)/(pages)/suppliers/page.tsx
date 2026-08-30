"use client";
import { useEffect, useRef, useState } from "react";
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend, ArcElement, DoughnutController } from "chart.js";
import { SessionGuard } from "@/app/(supplyChain)/components/server/SessionGuard";
import { supabase } from "@/app/(supplyChain)/lib/services/client/supabase";
import Cards from "@/app/(supplyChain)/components/global/Cards";
import { toast } from "sonner";
import { useConfirm } from "@/app/(supplyChain)/components/ui/ConfirmModal";
import { Pagination } from "@/app/(supplyChain)/components/global/pagination";
import { sanitizeText } from "@/app/(supplyChain)/components/global/sanitize";
import { CrudActionButton } from "@/app/(supplyChain)/components/ui/CrudActionButton";
import { AppButton } from "@/app/(supplyChain)/components/ui/AppButton";
import { StatusBadge, getPOStatusTone } from "@/app/(supplyChain)/components/ui/StatusBadge";
import { CardsSkeleton, SupplierChartsSkeleton, SupplierDirectorySkeleton, PurchaseHistorySkeleton } from "@/app/(supplyChain)/components/ui/SkeletonLoader";
let isRegistered = false;
interface Supplier {
    id: number;
    name: string;
    category: string;
    contact_person: string;
    phone: string;
    email: string;
    location: string;
    products: string;
    notes: string;
    fb_link: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}
interface PurchaseOrder {
    id: string;
    po_number: string;
    request_id: string | null;
    supplier_id: number | null;
    supplier_name: string;
    total_amount: number;
    status: string;
    paid: boolean; // Added paid field
    delivery_date: string | null;
    notes: string | null;
    items: any[];
    created_by: string | null;
    created_at: string;
    updated_at: string;
}
const ITEMS_PER_PAGE = 10;
export default function Suppliers() {
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
    const [selectedChartData, setSelectedChartData] = useState<{
        supplierName?: string;
        orderCount?: number;
        totalSpent?: number;
        category?: string;
        suppliers?: Supplier[];
    }>({});
    const [currentPOPage, setCurrentPOPage] = useState(1);
    const [chartReady, setChartReady] = useState(false);
    const PO_ITEMS_PER_PAGE = 15;
    const paginatedPurchaseOrders = purchaseOrders.slice((currentPOPage - 1) * PO_ITEMS_PER_PAGE, currentPOPage * PO_ITEMS_PER_PAGE);
    const POTotalPages = Math.max(1, Math.ceil(purchaseOrders.length / PO_ITEMS_PER_PAGE));
    const [currentPage, setCurrentPage] = useState(1);
    const [newSupplier, setNewSupplier] = useState({
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
    // po detail state
    const [selectedPurchaseOrder, setSelectedPurchaseOrder] = useState<PurchaseOrder | null>(null);
    const [showPurchaseOrderModal, setShowPurchaseOrderModal] = useState(false);
    const activityChartRef = useRef<HTMLCanvasElement>(null);
    const activityChartInstance = useRef<Chart | null>(null);
    const categoryChartRef = useRef<HTMLCanvasElement>(null);
    const categoryChartInstance = useRef<Chart | null>(null);
    // register charts
    useEffect(() => {
        if (!isRegistered) {
            Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend, ArcElement, DoughnutController);
            isRegistered = true;
        }
    }, []);
    // fetch data
    useEffect(() => {
        fetchSuppliers();
        fetchPurchaseOrders();
    }, []);
    // reset pagination
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, categoryFilter]);
    const fetchSuppliers = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from("suppliers")
                .select("*")
                .order("name");
            if (error)
                throw error;
            setSuppliers(data || []);
            const uniqueCategories = [...new Set(data?.map(s => s.category).filter(Boolean))];
            setCategories(uniqueCategories);
        }
        catch (error) {
            console.error("Error fetching suppliers:", error);
            toast.error("Failed to load suppliers");
        }
        finally {
            setIsLoading(false);
        }
    };
    const fetchPurchaseOrders = async () => {
        try {
            const { data, error } = await supabase
                .from("purchase_orders")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(50);
            if (error)
                throw error;
            setPurchaseOrders(data || []);
        }
        catch (error) {
            console.error("Error fetching purchase orders:", error);
        }
    };
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
            if (error)
                throw error;
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
        }
        catch (error: any) {
            console.error("Error adding supplier:", error);
            toast.error(error.message || "Failed to add supplier");
        }
        finally {
            setIsSubmitting(false);
        }
    };
    const handleUpdateSupplier = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingSupplier)
            return;
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
            if (error)
                throw error;
            toast.success(`Supplier "${editingSupplier.name}" updated successfully!`);
            setShowEditSupplierModal(false);
            setEditingSupplier(null);
            fetchSuppliers();
        }
        catch (error: any) {
            console.error("Error updating supplier:", error);
            toast.error(error.message || "Failed to update supplier");
        }
        finally {
            setIsSubmitting(false);
        }
    };
    const handleDeleteSupplier = async (supplierId: number, supplierName: string) => {
        const confirmed = await confirm({
            title: "Delete Supplier",
            message: `Are you sure you want to delete "${supplierName}"? This action cannot be undone.`,
            confirmText: "Delete",
            cancelText: "Cancel",
            confirmVariant: "danger",
        });
        if (!confirmed)
            return;
        try {
            const { error } = await supabase
                .from("suppliers")
                .delete()
                .eq("id", supplierId);
            if (error)
                throw error;
            toast.success(`Supplier "${supplierName}" deleted successfully!`);
            fetchSuppliers();
            setShowModal(false);
        }
        catch (error: any) {
            console.error("Error deleting supplier:", error);
            toast.error(error.message || "Failed to delete supplier");
        }
    };
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
        if (!confirmed)
            return;
        try {
            const { error } = await supabase
                .from("suppliers")
                .delete()
                .in("id", Array.from(selectedSuppliers));
            if (error)
                throw error;
            toast.success(`${selectedSuppliers.size} supplier(s) deleted successfully!`);
            setSelectedSuppliers(new Set());
            fetchSuppliers();
        }
        catch (error: any) {
            console.error("Error bulk deleting suppliers:", error);
            toast.error(error.message || "Failed to delete suppliers");
        }
    };
    const handleDeletePurchaseOrder = async (poId: string, poNumber: string) => {
        const confirmed = await confirm({
            title: "Delete Purchase Order",
            message: `Are you sure you want to delete PO "${poNumber}"? This action cannot be undone.`,
            confirmText: "Delete",
            cancelText: "Cancel",
            confirmVariant: "danger",
        });
        if (!confirmed)
            return;
        try {
            const { error } = await supabase
                .from("purchase_orders")
                .delete()
                .eq("id", poId);
            if (error)
                throw error;
            toast.success(`PO "${poNumber}" deleted successfully!`);
            fetchPurchaseOrders();
            fetchSuppliers();
        }
        catch (error: any) {
            console.error("Error deleting purchase order:", error);
            toast.error(error.message || "Failed to delete purchase order");
        }
    };
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
        if (!confirmed)
            return;
        try {
            const { error } = await supabase
                .from("purchase_orders")
                .delete()
                .in("id", Array.from(selectedPurchaseOrders));
            if (error)
                throw error;
            toast.success(`${selectedPurchaseOrders.size} purchase order(s) deleted successfully!`);
            setSelectedPurchaseOrders(new Set());
            fetchPurchaseOrders();
            fetchSuppliers();
        }
        catch (error: any) {
            console.error("Error bulk deleting purchase orders:", error);
            toast.error(error.message || "Failed to delete purchase orders");
        }
    };
    const handleToggleSelectPO = (poId: string) => {
        const newSelected = new Set(selectedPurchaseOrders);
        if (newSelected.has(poId)) {
            newSelected.delete(poId);
        }
        else {
            newSelected.add(poId);
        }
        setSelectedPurchaseOrders(newSelected);
    };
    const handleSelectAllPO = () => {
        if (selectedPurchaseOrders.size === paginatedPurchaseOrders.length) {
            setSelectedPurchaseOrders(new Set());
        }
        else {
            setSelectedPurchaseOrders(new Set(paginatedPurchaseOrders.map(po => po.id)));
        }
    };
    const handleToggleSelect = (supplierId: number) => {
        const newSelected = new Set(selectedSuppliers);
        if (newSelected.has(supplierId)) {
            newSelected.delete(supplierId);
        }
        else {
            newSelected.add(supplierId);
        }
        setSelectedSuppliers(newSelected);
    };
    const handleSelectAll = () => {
        if (selectedSuppliers.size === filteredSuppliers.length) {
            setSelectedSuppliers(new Set());
        }
        else {
            setSelectedSuppliers(new Set(filteredSuppliers.map(s => s.id)));
        }
    };
    const handleToggleActive = async (supplierId: number, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from("suppliers")
                .update({
                is_active: !currentStatus,
                updated_at: new Date().toISOString(),
            })
                .eq("id", supplierId);
            if (error)
                throw error;
            toast.success(`Supplier ${!currentStatus ? 'activated' : 'deactivated'} successfully!`);
            fetchSuppliers();
        }
        catch (error: any) {
            console.error("Error toggling supplier status:", error);
            toast.error(error.message || "Failed to update supplier status");
        }
    };
    // view po details
    const handleViewPurchaseOrder = (order: PurchaseOrder) => {
        setSelectedPurchaseOrder(order);
        setShowPurchaseOrderModal(true);
    };
    const filteredSuppliers = suppliers.filter(supplier => {
        const matchesSearch = supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            supplier.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            supplier.email?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = !categoryFilter || supplier.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });
    const totalPages = Math.max(1, Math.ceil(filteredSuppliers.length / ITEMS_PER_PAGE));
    const paginatedSuppliers = filteredSuppliers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const activeSuppliers = suppliers.filter(s => s.is_active).length;
    const totalOrders = purchaseOrders.length;
    // calc spending
    const supplierOrderCounts = suppliers.map(s => {
        const supplierOrders = purchaseOrders.filter(po => po.supplier_id === s.id);
        const paidOrders = purchaseOrders.filter(po => po.supplier_id === s.id && po.paid === true);
        return {
            ...s,
            orderCount: supplierOrders.length,
            totalSpent: paidOrders
                .reduce((sum, po) => sum + (po.total_amount || 0), 0)
        };
    });
    const topSupplier = supplierOrderCounts.length > 0
        ? supplierOrderCounts.reduce((a, b) => a.orderCount > b.orderCount ? a : b)
        : null;
    const categoryCount = suppliers.reduce((acc: Record<string, number>, s) => {
        acc[s.category] = (acc[s.category] || 0) + 1;
        return acc;
    }, {});
    const topCategory = Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";
    const getStatusBadge = (status: string) => {
        return (<StatusBadge tone={getPOStatusTone(status)} dot size="xs">
                {status}
            </StatusBadge>);
    };
    const getPaidBadge = (paid: boolean) => {
        return paid ? (<StatusBadge tone="purple" icon="fas fa-check-circle" size="xs">
                Paid ✓
            </StatusBadge>) : (<StatusBadge tone="neutral" icon="fas fa-lock" size="xs">
                Unpaid
            </StatusBadge>);
    };
    const statusCounts = purchaseOrders.reduce((acc, po) => {
        acc[po.status] = (acc[po.status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    // use paid
    const supplierStats = {
        totalOrders: purchaseOrders.length,
        totalSpent: purchaseOrders.reduce((sum, po) => sum + (po.total_amount || 0), 0),
        topSupplierName: topSupplier?.name || "N/A",
        topSupplierOrders: topSupplier?.orderCount || 0,
        statusCounts,
    };
    // create activity chart
    const createActivityChart = () => {
        if (activityChartInstance.current) {
            activityChartInstance.current.destroy();
            activityChartInstance.current = null;
        }
        const canvas = activityChartRef.current;
        if (!canvas) {
            return;
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return;
        }
        if (suppliers.length === 0 || purchaseOrders.length === 0) {
            return;
        }
        // get top 5
        const supplierOrderCounts = suppliers.map(s => {
            const supplierOrders = purchaseOrders.filter(po => po.supplier_id === s.id);
            const paidOrders = purchaseOrders.filter(po => po.supplier_id === s.id && po.paid === true);
            return {
                ...s,
                orderCount: supplierOrders.length,
                totalSpent: paidOrders.reduce((sum, po) => sum + (po.total_amount || 0), 0)
            };
        });
        const topSuppliers = [...supplierOrderCounts]
            .sort((a, b) => b.orderCount - a.orderCount)
            .slice(0, 5);
        const displaySuppliers = topSuppliers.some(s => s.orderCount > 0)
            ? topSuppliers
            : suppliers.slice(0, 5).map(s => ({
                ...s,
                orderCount: 0,
                totalSpent: 0
            }));
        const orderCounts = displaySuppliers.map(s => s.orderCount);
        const spendingData = displaySuppliers.map(s => s.totalSpent / 1000);
        activityChartInstance.current = new Chart(ctx, {
            type: "bar",
            data: {
                labels: displaySuppliers.map(s => s.name.length > 12 ? s.name.substring(0, 12) + "..." : s.name),
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
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            font: { size: 10 },
                            maxRotation: 35,
                            minRotation: 0,
                            color: "#94a3b8",
                        }
                    },
                    y: {
                        grid: { color: "#f1f5f9" },
                        beginAtZero: true,
                        ticks: {
                            font: { size: 10 },
                            color: "#94a3b8",
                            stepSize: Math.max(1, Math.ceil(Math.max(...orderCounts, ...spendingData) / 5)),
                        },
                    },
                },
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const element = elements[0];
                        const index = element.index;
                        const supplier = displaySuppliers[index];
                        if (supplier) {
                            const allOrders = purchaseOrders.filter(po => po.supplier_id === supplier.id);
                            const paidOrders = purchaseOrders.filter(po => po.supplier_id === supplier.id && po.paid === true);
                            setSelectedChartData({
                                supplierName: supplier.name,
                                orderCount: allOrders.length,
                                totalSpent: paidOrders.reduce((sum, po) => sum + (po.total_amount || 0), 0),
                            });
                            setShowActivityDetailModal(true);
                        }
                    }
                },
            },
        });
    };
    // create category chart
    const createCategoryChart = () => {
        if (categoryChartInstance.current) {
            categoryChartInstance.current.destroy();
            categoryChartInstance.current = null;
        }
        const canvas = categoryChartRef.current;
        if (!canvas) {
            return;
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return;
        }
        if (suppliers.length === 0) {
            return;
        }
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
        const labels = entries.map(e => e[0]);
        const data = entries.map(e => e[1]);
        categoryChartInstance.current = new Chart(ctx, {
            type: "doughnut",
            data: {
                labels: labels,
                datasets: [{
                        data: data,
                        backgroundColor: colors.slice(0, labels.length),
                        borderWidth: 2,
                        borderColor: "#ffffff",
                    }],
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
                                const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: ${context.parsed} (${percentage}%)`;
                            }
                        }
                    }
                },
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const element = elements[0];
                        const index = element.index;
                        const category = labels[index];
                        if (category) {
                            const suppliersInCategory = suppliers.filter(s => s.category === category);
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
    // init charts
    useEffect(() => {
        if (isLoading)
            return;
        // wait for dom
        const timer = setTimeout(() => {
            // check canvas
            if (activityChartRef.current && categoryChartRef.current) {
                createActivityChart();
                createCategoryChart();
            }
        }, 500);
        return () => {
            clearTimeout(timer);
        };
    }, [suppliers, purchaseOrders, isLoading]);
    // handle resize
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
    // cleanup charts
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
    return (<SessionGuard requiredRole={['Admin', 'Employee', 'Executive']}>
            <main className="main-shell bgCard">
                <div className="p-6 space-y-6 fade-in">
                    {/* header */}
                    <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-[#ffe6f0] border border-pink-300/90 dark:bg-[#341427] dark:border-[#67224c] flex items-center justify-center text-pink-600 dark:text-pink-300 text-xl shadow-[inset_0_1px_0_#ffffff,0_2px_6px_rgba(244,63,94,0.14)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_6px_rgba(0,0,0,0.6)] shrink-0 mt-0.5">
                            <i className="fa-solid fa-truck-ramp-box"></i>
                        </div>

                        <div className="w-full min-w-0">
                            <h1 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight leading-snug">
                                Supplier & Vendor Management
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                Track supplier purchases, order frequency, and spending patterns.
                            </p>

                            <div className="inline-flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2.5 
                      px-3 py-1.5 rounded-full 
                      bg-slate-50 dark:bg-slate-900 
                      border border-slate-200/90 dark:border-slate-800 
                      shadow-[inset_0_1px_0_#ffffff,0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_3px_rgba(0,0,0,0.4)] 
                      text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 max-w-full transition-all">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                                <i className="fas fa-users text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500"></i>
                                <span>Total Suppliers:</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[140px] sm:max-w-none">
                                    {suppliers.length}
                                </span>
                                <span className="text-slate-400 dark:text-slate-500 font-normal sm:border-l sm:border-slate-300/60 sm:pl-2 sm:ml-0.5 truncate max-w-[180px] sm:max-w-none">
                                    {suppliers.filter(s => s.is_active).length} active
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0 mt-2 sm:mt-0">
                            {selectedSuppliers.size > 0 && (<AppButton type="button" variant="danger" size="md" onClick={handleBulkDelete}>
                                    <i className="fas fa-trash-alt text-xs"/>
                                    <span>Delete Selected ({selectedSuppliers.size})</span>
                                </AppButton>)}
                            <AppButton type="button" variant="primary" size="md" onClick={() => setShowNewSupplierModal(true)}>
                                <i className="fas fa-plus text-xs"/>
                                <span>New Supplier</span>
                            </AppButton>
                        </div>
                    </div>

                    {/* stats cards */}
                    {isLoading ? (<CardsSkeleton count={4} className="grid-cols-2 sm:grid-cols-2 xl:grid-cols-4"/>) : (<div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                            <Cards frontIcon="fas fa-building mr-1" header="Active Suppliers" data={activeSuppliers.toString()} arrow="fas fa-arrow-up mr-1" description="Total active suppliers" backHeader="Supplier Stats" headerTextColor="text-slate-400" backDescription={`Total suppliers: ${suppliers.length}, Active: ${activeSuppliers}`} tooltip="View all suppliers" tooltipLink="#supplierTableId" badge={`${activeSuppliers} Active`}/>
                            <Cards frontIcon="fas fa-shopping-cart mr-1" header="Total Purchases" data={supplierStats.totalOrders.toString()} arrow="fas fa-arrow-up mr-1" description="Orders placed" backHeader="Order Stats" headerTextColor="text-slate-400" backDescription="Total purchase orders placed across all suppliers" tooltip="View all purchase orders" tooltipLink="/purchase-order" badge={`${supplierStats.totalOrders} Total`}/>
                            <Cards frontIcon="fas fa-trophy mr-1" header="Top Supplier" data={supplierStats.topSupplierName} arrow="fas fa-arrow-up mr-1" description={`${supplierStats.topSupplierOrders} orders`} backHeader="Top Supplier Details" headerTextColor="text-slate-200" backDescription={topSupplier ? `${topSupplier.category} - ${topSupplier.location}` : "No suppliers yet"} tooltip="View supplier details" tooltipLink={topSupplier ? `/supplier/${topSupplier.id}` : "#"} badge={topSupplier ? "Top" : "No Data"}/>
                            <Cards frontIcon="fas fa-tags mr-1" header="Top Category" data={topCategory} arrow="fas fa-arrow-up mr-1" description="Most common supplier type" backHeader="Category Breakdown" headerTextColor="text-slate-200" backDescription={`${topCategory} is the most common supplier category`} tooltip="View category details" tooltipLink="#" badge={topCategory || "N/A"}/>
                        </div>)}

                    {/* charts */}
                    {isLoading ? (<SupplierChartsSkeleton />) : (<div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
                            {/* purchase activity card */}
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs xl:col-span-3 flex flex-col justify-between transition-all">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="font-bold text-sm text-slate-900 dark:text-white">Purchase Activity by Supplier</h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Total orders and paid amount per supplier</p>
                                    </div>
                                    <div className="w-8 h-8 rounded-xl bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 flex items-center justify-center border border-pink-100 dark:border-pink-900/30">
                                        <i className="fas fa-chart-bar text-xs"></i>
                                    </div>
                                </div>
                                <div className="h-60 relative w-full flex items-center justify-center">
                                    {suppliers.length === 0 ? (<div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 p-6 text-center">
                                            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-3 border border-slate-200/60 dark:border-slate-700/50">
                                                <i className="fas fa-building text-base"></i>
                                            </div>
                                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">No suppliers registered yet</span>
                                            <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Add a supplier to start tracking purchases</span>
                                        </div>) : purchaseOrders.length === 0 ? (<div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 p-6 text-center">
                                            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-3 border border-slate-200/60 dark:border-slate-700/50">
                                                <i className="fas fa-shopping-cart text-base"></i>
                                            </div>
                                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">No purchase orders yet</span>
                                            <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Create a purchase order to see activity data</span>
                                        </div>) : (<canvas ref={activityChartRef} className="w-full h-full max-h-60"></canvas>)}
                                </div>
                            </div>

                            {/* supplier categories card */}
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs xl:col-span-2 flex flex-col justify-between transition-all">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="font-bold text-sm text-slate-900 dark:text-white">Supplier Categories</h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Distribution by category</p>
                                    </div>
                                    <div className="w-8 h-8 rounded-xl bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 flex items-center justify-center border border-pink-100 dark:border-pink-900/30">
                                        <i className="fas fa-chart-pie text-xs"></i>
                                    </div>
                                </div>
                                <div className="h-60 relative w-full flex items-center justify-center">
                                    {suppliers.length === 0 ? (<div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 p-6 text-center">
                                            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-3 border border-slate-200/60 dark:border-slate-700/50">
                                                <i className="fas fa-chart-pie text-base"></i>
                                            </div>
                                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">No data available</span>
                                            <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Category metrics will display once added</span>
                                        </div>) : (<canvas ref={categoryChartRef} className="w-full h-full max-h-60"></canvas>)}
                                </div>
                            </div>
                        </div>)}

                    {/* supplier directory table */}
                    <div className="card flex flex-col">
                        {/* filter bar */}
                        <div className="flex-shrink-0 p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-pink-500"/>
                                <h2 className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                                    Supplier Directory
                                </h2>
                            </div>

                            <div className="flex gap-2 items-center ml-auto">
                                <div className="relative flex-1 sm:flex-initial sm:max-w-xs ml-auto">
                                    <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs pointer-events-none"/>
                                    <input type="text" placeholder="Search suppliers..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full py-1.5 pl-8 pr-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-pink-500/40 focus:border-pink-500 dark:focus:border-pink-500/80 transition-all"/>
                                </div>

                                <div className="relative max-w-[180px] w-full sm:w-auto">
                                    <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Filter by category" className="w-full py-1.5 pl-3 pr-8 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-pink-500/40 focus:border-pink-500 dark:focus:border-pink-500/80 transition-all cursor-pointer appearance-none">
                                        <option value="">All categories</option>
                                        {categories.map((cat) => (<option key={cat} value={cat} className="dark:bg-slate-900 dark:text-slate-200">
                                                 {cat}
                                             </option>))}
                                    </select>
                                    <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-[10px] pointer-events-none"/>
                                </div>
                            </div>

                            {selectedSuppliers.size > 0 && (<button onClick={handleBulkDelete} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/40 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors cursor-pointer">
                                    <i className="fas fa-trash-alt text-[10px]"/>
                                    <span>Delete Selected ({selectedSuppliers.size})</span>
                                </button>)}
                        </div>

                        {/* scrollable table */}
                        <div className="flex-1 overflow-y-auto max-h-[500px] relative">
                            {isLoading ? (<SupplierDirectorySkeleton rows={ITEMS_PER_PAGE}/>) : filteredSuppliers.length === 0 ? (<div className="text-center py-12 text-slate-500 dark:text-slate-400">
                                    No suppliers found
                                </div>) : (<div className="overflow-x-auto">
                                    <table className="table-pro w-full text-left text-xs border-collapse p-1" id="supplierTableId">
                                        <thead className="bg-slate-50/75 dark:bg-slate-900/50 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                                            <tr>
                                                <th className="w-10 py-3.5 px-4">
                                                    <input type="checkbox" checked={selectedSuppliers.size === filteredSuppliers.length && filteredSuppliers.length > 0} onChange={handleSelectAll} aria-label="Select all suppliers" className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-pink-500 focus:ring-pink-500 dark:focus:ring-offset-slate-900 cursor-pointer"/>
                                                </th>
                                                <th className="py-3.5 px-4">Supplier ID</th>
                                                <th className="py-3.5 px-4">Supplier Name</th>
                                                <th className="py-3.5 px-4">Category</th>
                                                <th className="py-3.5 px-4">Contact</th>
                                                <th className="py-3.5 px-4">Location</th>
                                                <th className="py-3.5 px-4">Status</th>
                                                <th className="py-3.5 px-4 text-right! w-[150px] min-w-[150px]">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                            {paginatedSuppliers.map((supplier) => (<tr key={supplier.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                                                    <td className="py-3 px-4">
                                                        <input type="checkbox" checked={selectedSuppliers.has(supplier.id)} onChange={() => handleToggleSelect(supplier.id)} aria-label={`Select ${supplier.name}`} className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-pink-500 focus:ring-pink-500 dark:focus:ring-offset-slate-900 cursor-pointer"/>
                                                    </td>
                                                    <td data-label="Supplier ID" className="py-3 px-4 font-mono text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                                        SUP-{String(supplier.id).padStart(3, '0')}
                                                    </td>
                                                    <td data-label="Supplier Name" className="py-3 px-4">
                                                        <div className="font-semibold text-slate-900 dark:text-slate-100">{supplier.name}</div>
                                                        <div className="text-[11px] text-slate-500 dark:text-slate-400">{supplier.email}</div>
                                                    </td>
                                                    <td data-label="Category" className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                                                        {supplier.category}
                                                    </td>
                                                    <td data-label="Contact" className="py-3 px-4">
                                                        <div className="text-slate-800 dark:text-slate-200 font-medium">{supplier.contact_person}</div>
                                                        <div className="text-[11px] text-slate-500 dark:text-slate-400">{supplier.phone}</div>
                                                    </td>
                                                    <td data-label="Location" className="py-3 px-4 text-slate-700 dark:text-slate-300">
                                                        {supplier.location}
                                                    </td>
                                                    <td data-label="Status" className="py-3 px-4">
                                                        <StatusBadge tone={supplier.is_active ? 'emerald' : 'neutral'} dot size="xs" interactive onClick={() => handleToggleActive(supplier.id, supplier.is_active)} title={`Click to set ${supplier.name} as ${supplier.is_active ? 'Inactive' : 'Active'}`}>
                                                            {supplier.is_active ? 'Active' : 'Inactive'}
                                                        </StatusBadge>
                                                    </td>
                                                    <td data-label="Action" className="py-3 px-4 text-right w-[150px] min-w-[150px]">
                                                        <div className="flex items-center justify-end gap-2.5">
                                                            <CrudActionButton action="view" ariaLabel={`View ${supplier.name}`} onClick={() => {
                    setSelectedSupplier(supplier);
                    setShowModal(true);
                }}/>
                                                            <CrudActionButton action="edit" ariaLabel={`Edit ${supplier.name}`} onClick={() => {
                    setEditingSupplier({ ...supplier });
                    setShowEditSupplierModal(true);
                }}/>
                                                            <CrudActionButton action="delete" ariaLabel={`Delete ${supplier.name}`} onClick={() => handleDeleteSupplier(supplier.id, supplier.name)}/>
                                                        </div>
                                                    </td>
                                                </tr>))}
                                        </tbody>
                                    </table>
                                </div>)}
                        </div>

                        {/* pagination */}
                        <div className="flex-shrink-0 pagination-container-class flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-1 ">
                            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs">
                                <span className="text-slate-500 dark:text-slate-400 font-medium">
                                    Showing <span className="font-semibold text-slate-800 dark:text-white">
                                        {filteredSuppliers.length > 0 ? ((currentPage - 1) * ITEMS_PER_PAGE) + 1 : 0}
                                    </span> to{' '}
                                    <span className="font-semibold text-slate-800 dark:text-white">
                                        {Math.min(currentPage * ITEMS_PER_PAGE, filteredSuppliers.length)}
                                    </span> of{' '}
                                    <span className="font-semibold text-slate-800 dark:text-white">
                                        {filteredSuppliers.length}
                                    </span> suppliers
                                </span>

                                {selectedSuppliers.size > 0 && (<div className="flex items-center gap-2 pl-3 border-l border-slate-200 dark:border-white/10 animate-in fade-in duration-150">
                                        <span className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-bold border border-purple-200/60 dark:border-purple-800/40 shadow-2xs">
                                            {selectedSuppliers.size} selected
                                        </span>

                                        <button onClick={handleBulkDelete} className="px-3 py-1.5 text-xs font-semibold bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 rounded-xl border border-red-200/60 dark:border-red-800/40 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-2xs">
                                            <i className="fas fa-trash-alt text-xs"/>
                                            <span>Delete Selected</span>
                                        </button>

                                        <button onClick={() => {
                setSelectedSuppliers(new Set());
            }} className="p-1.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer" title="Clear selection" aria-label="Clear selection">
                                            <i className="fas fa-times text-xs"/>
                                        </button>
                                    </div>)}
                            </div>

                            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage}/>
                        </div>
                    </div>

                    {/* purchase history table */}
                    <div className="card flex flex-col">
                        <div className="flex-shrink-0 px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                            <div>
                                <div className="flex items-center gap-2.5 mb-1">
                                    <div className="w-2 h-2 rounded-full bg-pink-500"/>
                                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                        Recent Purchase History
                                    </h3>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Latest orders placed with suppliers
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {selectedPurchaseOrders.size > 0 && (<button onClick={handleBulkDeletePurchaseOrders} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/40 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors cursor-pointer">
                                        <i className="fas fa-trash-alt text-[10px]"/>
                                        <span>Delete Selected ({selectedPurchaseOrders.size})</span>
                                    </button>)}
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full border border-slate-200/60 dark:border-slate-700/60">
                                    {purchaseOrders?.length || 0} Total
                                </span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto max-h-[300px]">
                            {isLoading ? (<PurchaseHistorySkeleton rows={5}/>) : (<div className="overflow-x-auto">
                                    <table className="table-pro w-full text-left text-xs border-collapse p-1" id="purchaseOrderTableId">
                                        <thead className="bg-slate-50/75 dark:bg-slate-900/50 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px] sticky top-0 z-10">
                                            <tr>
                                                <th className="w-10 py-3.5 px-4">
                                                    <input type="checkbox" checked={selectedPurchaseOrders.size === paginatedPurchaseOrders.length && paginatedPurchaseOrders.length > 0} onChange={handleSelectAllPO} aria-label="Select all purchase orders" className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-pink-500 focus:ring-pink-500 dark:focus:ring-offset-slate-900 cursor-pointer"/>
                                                </th>
                                                <th className="py-3.5 px-4">Order #</th>
                                                <th className="py-3.5 px-4">Supplier</th>
                                                <th className="py-3.5 px-4">Total</th>
                                                <th className="py-3.5 px-4">Date</th>
                                                <th className="py-3.5 px-4">Status</th>
                                                <th className="py-3.5 px-4">Payment</th>
                                                <th className="py-3.5 px-4 text-right! w-[125px] min-w-[125px]">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                            {paginatedPurchaseOrders.length === 0 ? (<tr>
                                                    <td colSpan={8} className="text-center py-12 text-slate-400 dark:text-slate-500">
                                                        <div className="flex flex-col items-center justify-center gap-1.5">
                                                            <i className="fas fa-shopping-cart text-3xl mb-2 opacity-30"/>
                                                            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">No purchase orders found</span>
                                                            <span className="text-xs text-slate-400">Orders placed will appear here automatically.</span>
                                                        </div>
                                                    </td>
                                                </tr>) : (paginatedPurchaseOrders.map((order) => {
                const isSelected = selectedPurchaseOrders.has(order.id);
                return (<tr key={order.id} className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${isSelected
                        ? 'bg-pink-50/40 dark:bg-pink-950/20'
                        : ''}`}>
                                                            <td className="py-3.5 px-4">
                                                                <input type="checkbox" checked={isSelected} onChange={() => handleToggleSelectPO(order.id)} aria-label={`Select ${order.po_number}`} className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-pink-500 focus:ring-pink-500 dark:focus:ring-offset-slate-900 cursor-pointer"/>
                                                            </td>
                                                            <td data-label="Order #" className="py-3.5 px-4 font-mono text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                                                {order.po_number}
                                                            </td>
                                                            <td data-label="Supplier" className="py-3.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                                                                {order.supplier_name}
                                                            </td>
                                                            <td data-label="Total" className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100 font-mono">
                                                                {order.total_amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                                                            </td>
                                                            <td data-label="Date" className="py-3.5 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px] whitespace-nowrap">
                                                                {new Date(order.created_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                    })}
                                                            </td>
                                                            <td data-label="Status" className="py-3.5 px-4">
                                                                {getStatusBadge(order.status)}
                                                            </td>
                                                            <td data-label="Payment" className="py-3.5 px-4">
                                                                {getPaidBadge(order.paid || false)}
                                                            </td>
                                                            <td data-label="Actions" className="py-3.5 px-4 text-right w-[125px] min-w-[125px]">
                                                                <div className="flex items-center justify-end gap-2.5">
                                                                    <CrudActionButton action="view" ariaLabel={`View purchase order ${order.po_number}`} onClick={() => handleViewPurchaseOrder(order)}/>
                                                                    <CrudActionButton action="delete" ariaLabel={`Delete purchase order ${order.po_number}`} onClick={() => handleDeletePurchaseOrder(order.id, order.po_number)}/>
                                                                </div>
                                                            </td>
                                                        </tr>);
            }))}
                                        </tbody>
                                    </table>
                                </div>)}
                        </div>

                        <div className="flex-shrink-0 pagination-container-class flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-1 border-t border-slate-100 dark:border-slate-900">
                            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs">
                                <span className="text-slate-500 dark:text-slate-400 font-medium">
                                    Showing <span className="font-semibold text-slate-800 dark:text-white">
                                        {purchaseOrders.length > 0 ? ((currentPOPage - 1) * PO_ITEMS_PER_PAGE) + 1 : 0}
                                    </span> to{' '}
                                    <span className="font-semibold text-slate-800 dark:text-white">
                                        {Math.min(currentPOPage * PO_ITEMS_PER_PAGE, purchaseOrders.length)}
                                    </span> of{' '}
                                    <span className="font-semibold text-slate-800 dark:text-white">
                                        {purchaseOrders.length}
                                    </span> orders
                                </span>

                                {selectedPurchaseOrders.size > 0 && (<div className="flex items-center gap-2 pl-3 border-l border-slate-200 dark:border-white/10 animate-in fade-in duration-150">
                                        <span className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-bold border border-purple-200/60 dark:border-purple-800/40 shadow-2xs">
                                            {selectedPurchaseOrders.size} selected
                                        </span>
                                        <button onClick={() => setSelectedPurchaseOrders(new Set())} className="p-1.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer" title="Clear selection" aria-label="Clear selection">
                                            <i className="fas fa-times text-xs"/>
                                        </button>
                                    </div>)}
                            </div>

                            <Pagination currentPage={currentPOPage} totalPages={POTotalPages} onPageChange={setCurrentPOPage}/>
                        </div>
                    </div>
                </div>

                {/* view supplier modal */}
                {showModal && selectedSupplier && (<div className="fixed inset-0 z-[90] bg-slate-950/60 dark:bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl dark:shadow-2xl dark:shadow-black/70 w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-200/80 dark:border-slate-800 overflow-hidden">
                            <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800/80 flex items-start justify-between bg-slate-50/50 dark:bg-slate-900/50">
                                <div>
                                    <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                                        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                                            {selectedSupplier.name}
                                        </h2>
                                        <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border border-slate-200/80 dark:border-slate-700/60">
                                            SUP-{String(selectedSupplier.id).padStart(3, '0')}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                                        <span>Category:</span>
                                        <span className="text-slate-700 dark:text-slate-300 font-semibold">
                                            {selectedSupplier.category || 'General'}
                                        </span>
                                    </div>
                                </div>

                                <AppButton type="button" variant="neutral" size="icon-sm" onClick={() => setShowModal(false)} aria-label="Close modal">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                                    </svg>
                                </AppButton>
                            </div>

                            <div className="p-6 overflow-y-auto space-y-5">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center shrink-0 text-slate-500 dark:text-slate-400">
                                            <i className="fas fa-user text-xs"/>
                                        </div>
                                        <div className="min-w-0">
                                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
                                                Contact Person
                                            </span>
                                            <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                                                {selectedSupplier.contact_person || '—'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center shrink-0 text-slate-500 dark:text-slate-400">
                                            <i className="fas fa-phone text-xs"/>
                                        </div>
                                        <div className="min-w-0">
                                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
                                                Phone Number
                                            </span>
                                            <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 font-mono">
                                                {selectedSupplier.phone || '—'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center shrink-0 text-slate-500 dark:text-slate-400">
                                            <i className="fas fa-envelope text-xs"/>
                                        </div>
                                        <div className="min-w-0">
                                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
                                                Email Address
                                            </span>
                                            <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 truncate font-mono">
                                                {selectedSupplier.email || '—'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center shrink-0 text-slate-500 dark:text-slate-400">
                                            <i className="fas fa-map-marker-alt text-xs"/>
                                        </div>
                                        <div className="min-w-0">
                                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
                                                Location
                                            </span>
                                            <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                                                {selectedSupplier.location || '—'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {selectedSupplier.products && (<div>
                                        <h3 className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                                            Products & Services
                                        </h3>
                                        <div className="flex flex-wrap gap-1.5">
                                            {selectedSupplier.products.split(',').map((product: string, idx: number) => (<span key={idx} className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/60 rounded-lg text-xs font-medium">
                                                    {product.trim()}
                                                </span>))}
                                        </div>
                                    </div>)}

                                {selectedSupplier.notes && (<div>
                                        <h3 className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                                            Internal Notes
                                        </h3>
                                        <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50/80 dark:bg-slate-800/30 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80 leading-relaxed whitespace-pre-wrap">
                                            {selectedSupplier.notes}
                                        </p>
                                    </div>)}

                                {purchaseOrders.filter((po) => po.supplier_id === selectedSupplier.id).length > 0 && (<div>
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                                Recent Purchase Orders
                                            </h3>
                                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                                                Showing last 5
                                            </span>
                                        </div>

                                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                            {purchaseOrders
                    .filter((po) => po.supplier_id === selectedSupplier.id)
                    .slice(0, 5)
                    .map((po) => (<div key={po.id} className="flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40 px-3.5 py-2.5 rounded-xl border border-slate-100 dark:border-slate-800/70 hover:border-slate-200 dark:hover:border-slate-700 transition-colors">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                                {po.po_number}
                                                            </span>
                                                        </div>

                                                        <div className="flex items-center gap-3.5">
                                                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">
                                                                {po.total_amount?.toLocaleString() || '0'}
                                                            </span>
                                                            <div>{getStatusBadge(po.status)}</div>
                                                            <div>{getPaidBadge(po.paid || false)}</div>
                                                        </div>
                                                    </div>))}
                                        </div>
                                    </div>)}
                            </div>

                            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
                                <AppButton type="button" variant="danger" size="sm" onClick={() => handleDeleteSupplier(selectedSupplier.id, selectedSupplier.name)}>
                                    Delete Supplier
                                </AppButton>

                                <div className="flex items-center gap-2">
                                    <AppButton type="button" variant="neutral" size="sm" onClick={() => setShowModal(false)}>
                                        Close
                                    </AppButton>
                                    <AppButton type="button" variant="primary" size="sm" onClick={() => {
                setEditingSupplier({ ...selectedSupplier });
                setShowEditSupplierModal(true);
                setShowModal(false);
            }}>
                                        Edit Supplier
                                    </AppButton>
                                </div>
                            </div>
                        </div>
                    </div>)}

                {/* add supplier modal */}
                {showNewSupplierModal && (<div className="fixed inset-0 z-[90] bg-slate-950/60 dark:bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl dark:shadow-2xl dark:shadow-black/60 w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-200/80 dark:border-slate-800 overflow-hidden">
                            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-slate-800/80">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 flex items-center justify-center border border-pink-100 dark:border-pink-900/30">
                                        <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                                            Add New Supplier
                                        </h2>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Register and manage a procurement vendor profile
                                        </p>
                                    </div>
                                </div>

                                <AppButton type="button" variant="neutral" size="icon-sm" onClick={() => setShowNewSupplierModal(false)} aria-label="Close modal">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                                    </svg>
                                </AppButton>
                            </div>

                            <form onSubmit={handleAddSupplier} className="flex-1 overflow-y-auto p-6 space-y-4.5">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                            Supplier Name <span className="text-rose-500">*</span>
                                        </label>
                                        <input type="text" className="w-full px-3.5 py-2 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/70 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 dark:focus:border-pink-500/80 focus:bg-white dark:focus:bg-slate-800/80 transition-all shadow-2xs" placeholder="e.g. Apex Tire & Auto Supplies" value={newSupplier.name} onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })} required/>
                                    </div>

                                    <div>
                                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                            Category <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <select className="w-full px-3.5 py-2 pr-9 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/70 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 dark:focus:border-pink-500/80 focus:bg-white dark:focus:bg-slate-800/80 transition-all appearance-none cursor-pointer shadow-2xs" value={newSupplier.category} onChange={(e) => setNewSupplier({ ...newSupplier, category: e.target.value })} required>
                                                <option value="" disabled className="dark:bg-slate-900 text-slate-400">
                                                    Select category
                                                </option>
                                                {categories.map((cat) => (<option key={cat} value={cat} className="dark:bg-slate-900 dark:text-slate-200">
                                                        {cat}
                                                    </option>))}
                                                <option value="Other" className="dark:bg-slate-900 dark:text-slate-200">
                                                    Other
                                                </option>
                                            </select>
                                            <svg className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                                            </svg>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                            Contact Person <span className="text-rose-500">*</span>
                                        </label>
                                        <input type="text" className="w-full px-3.5 py-2 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/70 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 dark:focus:border-pink-500/80 focus:bg-white dark:focus:bg-slate-800/80 transition-all shadow-2xs" placeholder="Full Name" value={newSupplier.contact_person} onChange={(e) => setNewSupplier({ ...newSupplier, contact_person: sanitizeText(e.target.value) })} required/>
                                    </div>

                                    <div>
                                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                            Phone Number <span className="text-rose-500">*</span>
                                        </label>
                                        <input type="tel" className="w-full px-3.5 py-2 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/70 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 dark:focus:border-pink-500/80 focus:bg-white dark:focus:bg-slate-800/80 transition-all shadow-2xs" placeholder="+63 912 345 6789" value={newSupplier.phone} onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })} required/>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                            Email Address <span className="text-rose-500">*</span>
                                        </label>
                                        <input type="email" className="w-full px-3.5 py-2 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/70 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 dark:focus:border-pink-500/80 focus:bg-white dark:focus:bg-slate-800/80 transition-all shadow-2xs" placeholder="contact@gmail.com" value={newSupplier.email} onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })} required/>
                                    </div>

                                    <div>
                                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                            Location / Address <span className="text-rose-500">*</span>
                                        </label>
                                        <input type="text" className="w-full px-3.5 py-2 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/70 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 dark:focus:border-pink-500/80 focus:bg-white dark:focus:bg-slate-800/80 transition-all shadow-2xs" placeholder="City, Province" value={newSupplier.location} onChange={(e) => setNewSupplier({ ...newSupplier, location: sanitizeText(e.target.value) })} required/>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                        Facebook Link
                                    </label>
                                    <input className="w-full px-3.5 py-2 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/70 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 dark:focus:border-pink-500/80 focus:bg-white dark:focus:bg-slate-800/80 transition-all resize-none shadow-2xs" placeholder="https://www.facebook.com/share/12345446/" value={newSupplier.fb_link} onChange={(e) => setNewSupplier({ ...newSupplier, fb_link: sanitizeText(e.target.value) })}/>
                                </div>


                                <div>
                                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                        Products / Services Offered
                                    </label>
                                    <textarea rows={2} className="w-full px-3.5 py-2 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/70 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 dark:focus:border-pink-500/80 focus:bg-white dark:focus:bg-slate-800/80 transition-all resize-none shadow-2xs" placeholder="e.g. Heavy equipment tires, brake pads, routine maintenance services" value={newSupplier.products} onChange={(e) => setNewSupplier({ ...newSupplier, products: sanitizeText(e.target.value) })}/>
                                </div>

                                <div>
                                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                        Internal Notes
                                    </label>
                                    <textarea rows={2} className="w-full px-3.5 py-2 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/70 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 dark:focus:border-pink-500/80 focus:bg-white dark:focus:bg-slate-800/80 transition-all resize-none shadow-2xs" placeholder="Payment terms, delivery lead times, or special remarks" value={newSupplier.notes} onChange={(e) => setNewSupplier({ ...newSupplier, notes: sanitizeText(e.target.value) })}/>
                                </div>

                                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                                    <AppButton type="button" variant="neutral" size="sm" onClick={() => setShowNewSupplierModal(false)}>
                                        Cancel
                                    </AppButton>
                                    <AppButton type="submit" variant="primary" size="sm" disabled={isSubmitting} loading={isSubmitting}>
                                        <span>Add Supplier</span>
                                    </AppButton>
                                </div>
                            </form>
                        </div>
                    </div>)}

                {/* edit supplier modal */}
                {showEditSupplierModal && editingSupplier && (<div className="fixed inset-0 z-[90] bg-slate-950/60 dark:bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl dark:shadow-2xl dark:shadow-black/60 w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-200/80 dark:border-slate-800 overflow-hidden">
                            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-slate-800/80">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 flex items-center justify-center border border-pink-100 dark:border-pink-900/30">
                                        <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                                            Edit Supplier
                                        </h2>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Update vendor records and operational status
                                        </p>
                                    </div>
                                </div>

                                <AppButton type="button" variant="neutral" size="icon-sm" onClick={() => {
                setShowEditSupplierModal(false);
                setEditingSupplier(null);
            }} aria-label="Close modal">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                                    </svg>
                                </AppButton>
                            </div>

                            <form onSubmit={handleUpdateSupplier} className="flex-1 overflow-y-auto p-6 space-y-4.5">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                            Supplier Name <span className="text-rose-500">*</span>
                                        </label>
                                        <input type="text" className="w-full px-3.5 py-2 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/70 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 dark:focus:border-pink-500/80 focus:bg-white dark:focus:bg-slate-800/80 transition-all shadow-2xs" value={editingSupplier?.name || ""} onChange={(e) => setEditingSupplier({ ...editingSupplier, name: e.target.value })} required/>
                                    </div>

                                    <div>
                                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                            Category <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <select className="w-full px-3.5 py-2 pr-9 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/70 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 dark:focus:border-pink-500/80 focus:bg-white dark:focus:bg-slate-800/80 transition-all appearance-none cursor-pointer shadow-2xs" value={editingSupplier?.category || ""} onChange={(e) => setEditingSupplier({ ...editingSupplier, category: e.target.value })} required>
                                                {categories.map((cat) => (<option key={cat} value={cat} className="dark:bg-slate-900 dark:text-slate-200">
                                                        {cat}
                                                    </option>))}
                                                <option value="Other" className="dark:bg-slate-900 dark:text-slate-200">
                                                    Other
                                                </option>
                                            </select>
                                            <svg className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                                            </svg>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                            Contact Person <span className="text-rose-500">*</span>
                                        </label>
                                        <input type="text" className="w-full px-3.5 py-2 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/70 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 dark:focus:border-pink-500/80 focus:bg-white dark:focus:bg-slate-800/80 transition-all shadow-2xs" value={editingSupplier?.contact_person || ""} onChange={(e) => setEditingSupplier({ ...editingSupplier, contact_person: e.target.value })} required/>
                                    </div>

                                    <div>
                                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                            Phone Number <span className="text-rose-500">*</span>
                                        </label>
                                        <input type="tel" className="w-full px-3.5 py-2 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/70 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 dark:focus:border-pink-500/80 focus:bg-white dark:focus:bg-slate-800/80 transition-all shadow-2xs" value={editingSupplier?.phone || ""} onChange={(e) => setEditingSupplier({ ...editingSupplier, phone: e.target.value })} required/>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                            Email Address <span className="text-rose-500">*</span>
                                        </label>
                                        <input type="email" className="w-full px-3.5 py-2 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/70 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 dark:focus:border-pink-500/80 focus:bg-white dark:focus:bg-slate-800/80 transition-all shadow-2xs" value={editingSupplier?.email || ""} onChange={(e) => setEditingSupplier({ ...editingSupplier, email: e.target.value })} required/>
                                    </div>

                                    <div>
                                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                            Location / Address <span className="text-rose-500">*</span>
                                        </label>
                                        <input type="text" className="w-full px-3.5 py-2 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/70 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 dark:focus:border-pink-500/80 focus:bg-white dark:focus:bg-slate-800/80 transition-all shadow-2xs" value={editingSupplier?.location || ""} onChange={(e) => setEditingSupplier({ ...editingSupplier, location: e.target.value })} required/>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                        Facebook Link
                                    </label>
                                    <input className="w-full px-3.5 py-2 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/70 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 dark:focus:border-pink-500/80 focus:bg-white dark:focus:bg-slate-800/80 transition-all resize-none shadow-2xs" placeholder="https://www.facebook.com/share/12345446/" value={newSupplier.fb_link} onChange={(e) => setNewSupplier({ ...newSupplier, fb_link: sanitizeText(e.target.value) })}/>
                                </div>

                                <div>
                                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                        Products / Services Offered
                                    </label>
                                    <textarea rows={2} className="w-full px-3.5 py-2 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/70 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 dark:focus:border-pink-500/80 focus:bg-white dark:focus:bg-slate-800/80 transition-all resize-none shadow-2xs" placeholder="List products or services offered (comma separated)" value={editingSupplier?.products || ""} onChange={(e) => setEditingSupplier({ ...editingSupplier, products: e.target.value })}/>
                                </div>

                                <div>
                                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                        Internal Notes
                                    </label>
                                    <textarea rows={2} className="w-full px-3.5 py-2 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/70 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 dark:focus:border-pink-500/80 focus:bg-white dark:focus:bg-slate-800/80 transition-all resize-none shadow-2xs" placeholder="Additional supplier details or terms" value={editingSupplier?.notes || ""} onChange={(e) => setEditingSupplier({ ...editingSupplier, notes: e.target.value })}/>
                                </div>

                                <div className="p-3 bg-slate-50/80 dark:bg-slate-800/30 rounded-xl border border-slate-200/70 dark:border-slate-800">
                                    <label className="flex items-center gap-3 cursor-pointer select-none">
                                        <input type="checkbox" checked={Boolean(editingSupplier?.is_active)} onChange={(e) => setEditingSupplier({ ...editingSupplier, is_active: e.target.checked })} className="w-4 h-4 rounded text-pink-500 focus:ring-pink-500/20 border-slate-300 dark:border-slate-600 dark:bg-slate-700 cursor-pointer"/>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                                Active Vendor Status
                                            </span>
                                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                                {editingSupplier?.is_active
                ? "This supplier is active and available for purchase orders."
                : "Inactive suppliers will be hidden from procurement selection."}
                                            </span>
                                        </div>
                                    </label>
                                </div>

                                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                                    <AppButton type="button" variant="neutral" size="sm" onClick={() => {
                setShowEditSupplierModal(false);
                setEditingSupplier(null);
            }}>
                                        Cancel
                                    </AppButton>
                                    <AppButton type="submit" variant="primary" size="sm" disabled={isSubmitting} loading={isSubmitting}>
                                        <span>Save Changes</span>
                                    </AppButton>
                                </div>
                            </form>
                        </div>
                    </div>)}

                {/* activity chart detail modal */}
                {showActivityDetailModal && selectedChartData.supplierName && (<div className="fixed inset-0 z-[90] bg-slate-950/60 dark:bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl dark:shadow-2xl dark:shadow-black/70 w-full max-w-md max-h-[80vh] flex flex-col border border-slate-200/80 dark:border-slate-800 overflow-hidden">
                            <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
                                <div>
                                    <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                                        Supplier Details
                                    </h2>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {selectedChartData.supplierName}
                                    </p>
                                </div>
                                <AppButton type="button" variant="neutral" size="icon-sm" onClick={() => setShowActivityDetailModal(false)} aria-label="Close modal">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                                    </svg>
                                </AppButton>
                            </div>

                            <div className="p-6 space-y-4 overflow-y-auto">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 text-center">
                                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                            Total Orders
                                        </p>
                                        <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                                            {selectedChartData.orderCount || 0}
                                        </p>
                                    </div>
                                    <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 text-center">
                                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                            Total Paid
                                        </p>
                                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                                            {(selectedChartData.totalSpent || 0).toLocaleString()}
                                        </p>
                                    </div>
                                </div>

                                <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80">
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                                        Recent Orders
                                    </p>
                                    <div className="space-y-2 max-h-32 overflow-y-auto">
                                        {purchaseOrders
                .filter(po => po.supplier_name === selectedChartData.supplierName)
                .slice(0, 5)
                .map((po) => (<div key={po.id} className="flex items-center justify-between text-xs">
                                                    <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                                                        {po.po_number}
                                                    </span>
                                                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                                                        {po.total_amount?.toLocaleString() || '0'}
                                                    </span>
                                                    <div>{getStatusBadge(po.status)}</div>
                                                    <div>{getPaidBadge(po.paid || false)}</div>
                                                </div>))}
                                        {purchaseOrders.filter(po => po.supplier_name === selectedChartData.supplierName).length === 0 && (<p className="text-xs text-slate-400 dark:text-slate-500 text-center py-2">
                                                No orders found for this supplier
                                            </p>)}
                                    </div>
                                </div>
                            </div>

                            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end">
                                <AppButton type="button" variant="neutral" size="sm" onClick={() => setShowActivityDetailModal(false)}>
                                    Close
                                </AppButton>
                            </div>
                        </div>
                    </div>)}

                {/* category detail modal */}
                {showCategoryDetailModal && selectedChartData.category && (<div className="fixed inset-0 z-[90] bg-slate-950/60 dark:bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl dark:shadow-2xl dark:shadow-black/70 w-full max-w-lg max-h-[80vh] flex flex-col border border-slate-200/80 dark:border-slate-800 overflow-hidden">
                            <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
                                <div>
                                    <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                                        Category Details
                                    </h2>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {selectedChartData.category} • {selectedChartData.suppliers?.length || 0} suppliers
                                    </p>
                                </div>
                                <AppButton type="button" variant="neutral" size="icon-sm" onClick={() => setShowCategoryDetailModal(false)} aria-label="Close modal">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                                    </svg>
                                </AppButton>
                            </div>

                            <div className="p-6 overflow-y-auto">
                                <div className="space-y-3">
                                    <div className="grid grid-cols-3 gap-3 mb-4">
                                        <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 text-center">
                                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                                Suppliers
                                            </p>
                                            <p className="text-xl font-bold text-slate-900 dark:text-white">
                                                {selectedChartData.suppliers?.length || 0}
                                            </p>
                                        </div>
                                        <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 text-center">
                                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                                Active
                                            </p>
                                            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                                                {selectedChartData.suppliers?.filter(s => s.is_active).length || 0}
                                            </p>
                                        </div>
                                        <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 text-center">
                                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                                Inactive
                                            </p>
                                            <p className="text-xl font-bold text-rose-600 dark:text-rose-400">
                                                {selectedChartData.suppliers?.filter(s => !s.is_active).length || 0}
                                            </p>
                                        </div>
                                    </div>

                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                                        Suppliers in this category
                                    </p>

                                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                        {selectedChartData.suppliers?.map((supplier) => {
                const orderCount = purchaseOrders.filter(po => po.supplier_id === supplier.id).length;
                return (<div key={supplier.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 hover:border-slate-200 dark:hover:border-slate-700 transition-colors">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                                                            {supplier.name}
                                                        </p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                                            {supplier.contact_person} • {supplier.location}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-3 ml-3 shrink-0">
                                                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                                            {orderCount} orders
                                                        </span>
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${supplier.is_active
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                        : 'bg-slate-50 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400'}`}>
                                                            {supplier.is_active ? 'Active' : 'Inactive'}
                                                        </span>
                                                    </div>
                                                </div>);
            })}
                                    </div>
                                </div>
                            </div>

                            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end">
                                <AppButton type="button" variant="neutral" size="sm" onClick={() => setShowCategoryDetailModal(false)}>
                                    Close
                                </AppButton>
                            </div>
                        </div>
                    </div>)}

                {/* po detail modal */}
                {showPurchaseOrderModal && selectedPurchaseOrder && (<div className="fixed inset-0 z-[90] bg-slate-950/60 dark:bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl dark:shadow-2xl dark:shadow-black/70 w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-200/80 dark:border-slate-800 overflow-hidden">
                            <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800/80 flex items-start justify-between bg-slate-50/50 dark:bg-slate-900/50">
                                <div>
                                    <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                                        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                                            Purchase Order
                                        </h2>
                                        <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border border-slate-200/80 dark:border-slate-700/60">
                                            {selectedPurchaseOrder.po_number}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                                        <span>Supplier:</span>
                                        <span className="text-slate-700 dark:text-slate-300 font-semibold">
                                            {selectedPurchaseOrder.supplier_name}
                                        </span>
                                    </div>
                                </div>

                                <AppButton type="button" variant="neutral" size="icon-sm" onClick={() => setShowPurchaseOrderModal(false)} aria-label="Close modal">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                                    </svg>
                                </AppButton>
                            </div>

                            <div className="p-6 overflow-y-auto space-y-5">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center shrink-0 text-slate-500 dark:text-slate-400">
                                            <i className="fas fa-building text-xs"/>
                                        </div>
                                        <div className="min-w-0">
                                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
                                                Supplier
                                            </span>
                                            <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                                                {selectedPurchaseOrder.supplier_name}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center shrink-0 text-slate-500 dark:text-slate-400">
                                            <i className="fas fa-dollar-sign text-xs"/>
                                        </div>
                                        <div className="min-w-0">
                                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
                                                Total Amount
                                            </span>
                                            <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                                {selectedPurchaseOrder.total_amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center shrink-0 text-slate-500 dark:text-slate-400">
                                            <i className="fas fa-calendar-alt text-xs"/>
                                        </div>
                                        <div className="min-w-0">
                                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
                                                Date Created
                                            </span>
                                            <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                                                {new Date(selectedPurchaseOrder.created_at).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            })}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center shrink-0 text-slate-500 dark:text-slate-400">
                                            <i className="fas fa-truck text-xs"/>
                                        </div>
                                        <div className="min-w-0">
                                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
                                                Delivery Date
                                            </span>
                                            <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                                                {selectedPurchaseOrder.delivery_date
                ? new Date(selectedPurchaseOrder.delivery_date).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                })
                : 'Not set'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center shrink-0 text-slate-500 dark:text-slate-400">
                                            <i className="fas fa-tag text-xs"/>
                                        </div>
                                        <div className="min-w-0">
                                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
                                                Status
                                            </span>
                                            <div>{getStatusBadge(selectedPurchaseOrder.status)}</div>
                                        </div>
                                    </div>

                                    <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center shrink-0 text-slate-500 dark:text-slate-400">
                                            <i className="fas fa-credit-card text-xs"/>
                                        </div>
                                        <div className="min-w-0">
                                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
                                                Payment Status
                                            </span>
                                            <div>{getPaidBadge(selectedPurchaseOrder.paid || false)}</div>
                                        </div>
                                    </div>
                                </div>

                                {selectedPurchaseOrder.notes && (<div>
                                        <h3 className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                                            Order Notes
                                        </h3>
                                        <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50/80 dark:bg-slate-800/30 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80 leading-relaxed whitespace-pre-wrap">
                                            {selectedPurchaseOrder.notes}
                                        </p>
                                    </div>)}

                                {selectedPurchaseOrder.items && selectedPurchaseOrder.items.length > 0 && (<div>
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                                Order Items
                                            </h3>
                                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                                                {selectedPurchaseOrder.items.length} items
                                            </span>
                                        </div>

                                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                            {selectedPurchaseOrder.items.map((item: any, idx: number) => (<div key={idx} className="flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40 px-3.5 py-2.5 rounded-xl border border-slate-100 dark:border-slate-800/70">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                            {item.name || `Item ${idx + 1}`}
                                                        </span>
                                                        {item.quantity && (<span className="text-xs text-slate-500 dark:text-slate-400">
                                                                × {item.quantity}
                                                            </span>)}
                                                    </div>
                                                    <div className="flex items-center gap-3.5">
                                                        {item.price && (<span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                                                @{item.price.toLocaleString()}
                                                            </span>)}
                                                        {item.total && (<span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                                                {item.total.toLocaleString()}
                                                            </span>)}
                                                    </div>
                                                </div>))}
                                        </div>
                                    </div>)}
                            </div>

                            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-end gap-2">
                                <AppButton type="button" variant="neutral" size="sm" onClick={() => setShowPurchaseOrderModal(false)}>
                                    Close
                                </AppButton>
                                <AppButton type="button" variant="primary" size="sm" onClick={() => {
                setShowPurchaseOrderModal(false);
                toast.info('Edit functionality coming soon');
            }}>
                                    Edit Order
                                </AppButton>
                            </div>
                        </div>
                    </div>)}
            </main>
        </SessionGuard>);
}
