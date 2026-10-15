import { NextRequest, NextResponse } from 'next/server';
import {
    supabaseAdmin,
    validateExecutiveSession,
    verifyExecutiveVerificationToken,
    getManilaMonthRange,
} from '../authHelper';

export async function GET(req: NextRequest) {
    try {
        // 1. Session and role validation
        const authResult = await validateExecutiveSession(req);
        if (authResult.errorResponse) {
            return NextResponse.json(
                { success: false, error: authResult.errorResponse.error },
                { status: authResult.errorResponse.status }
            );
        }

        const { user } = authResult.auth!;

        // 2. Strict verification token validation
        const verificationToken = req.headers.get('x-executive-verification') ||
                                   new URL(req.url).searchParams.get('verification_token');

        const verification = verifyExecutiveVerificationToken(verificationToken, user.id, user.email);
        if (!verification.valid) {
            return NextResponse.json(
                {
                    success: false,
                    error: verification.reason || 'Confidential report access denied. Executive password verification required.',
                    needsVerification: true,
                },
                { status: 403 }
            );
        }

        // 3. Parse parameters
        const { searchParams } = new URL(req.url);
        const category = searchParams.get('category')?.toLowerCase().trim();
        const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10);
        const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1), 10);

        if (!category) {
            return NextResponse.json(
                { success: false, error: 'Category parameter is required.' },
                { status: 400 }
            );
        }

        const range = getManilaMonthRange(year, month);
        const { startUtc, endUtc, periodLabel, cutoffLabel } = range;

        // 4. Build category-specific detailed dataset
        let reportData: any = null;

        switch (category) {
            // ==========================================
            // 1. INVENTORY REPORT
            // ==========================================
            case 'inventory': {
                const { data: items, error } = await supabaseAdmin
                    .from('inventory_items')
                    .select('*')
                    .order('item_name', { ascending: true });

                if (error) throw error;
                const itemList = items || [];

                let totalStockUnits = 0;
                let totalValuation = 0;
                let lowStockCount = 0;
                let outOfStockCount = 0;
                let totalDamagedUnits = 0;
                const categoryBreakdown: Record<string, { count: number; value: number }> = {};

                const records = itemList.map((it) => {
                    const stock = Number(it.current_stock) || 0;
                    const minStock = Number(it.minimum_stock) || 0;
                    const unitPrice = Number(it.purchase_price) || 0;
                    const damaged = Number(it.quarantine_stock) || 0;
                    const valuation = Math.max(0, stock) * Math.max(0, unitPrice);
                    const cat = it.category || 'Uncategorized';

                    totalStockUnits += stock;
                    totalValuation += valuation;
                    totalDamagedUnits += damaged;

                    let stockStatus = 'Healthy';
                    if (stock <= 0) {
                        stockStatus = 'Out of Stock';
                        outOfStockCount++;
                    } else if (stock <= minStock) {
                        stockStatus = 'Low Stock';
                        lowStockCount++;
                    }

                    if (!categoryBreakdown[cat]) {
                        categoryBreakdown[cat] = { count: 0, value: 0 };
                    }
                    categoryBreakdown[cat].count++;
                    categoryBreakdown[cat].value += valuation;

                    return {
                        id: it.id,
                        sku: it.item_code || 'N/A',
                        name: it.item_name || 'Inventory Item',
                        category: cat,
                        stock_level: stock,
                        minimum_level: minStock,
                        unit_price: unitPrice,
                        valuation,
                        damaged_quarantine: damaged,
                        status: stockStatus,
                        location: it.storage_location || 'Main Storage',
                    };
                });

                const chartData = Object.entries(categoryBreakdown).map(([name, data]) => ({
                    name,
                    itemsCount: data.count,
                    valuation: Math.round(data.value),
                }));

                reportData = {
                    title: 'Confidential Monthly Inventory Report',
                    summary: `Comprehensive inventory balance and valuation audit as of ${cutoffLabel}. Highlights usable on-hand quantities, threshold alerts, and quarantined defective units held in storage.`,
                    periodLabel: cutoffLabel,
                    kpis: [
                        { label: 'Total Tracked SKUs', value: records.length.toLocaleString(), note: 'Active cataloged items' },
                        { label: 'Usable Stock Balance', value: totalStockUnits.toLocaleString(), note: 'Excludes quarantined items' },
                        { label: 'Total Inventory Valuation', value: `₱${totalValuation.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, note: 'Based on purchase prices' },
                        { label: 'Low Stock Alerts', value: lowStockCount, status: lowStockCount > 0 ? 'warning' : 'good', note: 'Below minimum threshold' },
                        { label: 'Out of Stock SKUs', value: outOfStockCount, status: outOfStockCount > 0 ? 'danger' : 'good', note: 'Depleted on-hand items' },
                        { label: 'Quarantined / Defective', value: totalDamagedUnits.toLocaleString(), note: 'Held pending replacement' },
                    ],
                    chartData,
                    chartConfig: { type: 'bar', xKey: 'name', yKey: 'valuation', label: 'Valuation by Category (₱)' },
                    records,
                };
                break;
            }

            // ==========================================
            // 2. STOCK MOVEMENT REPORT
            // ==========================================
            case 'stock-movements': {
                const { data: movements, error } = await supabaseAdmin
                    .from('stock_movements')
                    .select('*')
                    .gte('created_at', startUtc)
                    .lte('created_at', endUtc)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                const monthMovements = movements || [];

                let stockIn = 0;
                let stockOut = 0;
                let adjustments = 0;
                let returns = 0;

                const dailyDistribution: Record<string, { inQty: number; outQty: number }> = {};

                const records = monthMovements.map((m) => {
                    const type = (m.movement_type || '').toLowerCase();
                    const qty = Number(m.quantity) || 0;
                    const dateStr = (m.created_at || '').slice(0, 10);

                    if (type.includes('in') || type.includes('receive')) {
                        stockIn += Math.abs(qty);
                    } else if (type.includes('out') || type.includes('issue')) {
                        stockOut += Math.abs(qty);
                    } else if (type.includes('adjust')) {
                        adjustments++;
                    } else if (type.includes('return')) {
                        returns++;
                    }

                    if (dateStr) {
                        if (!dailyDistribution[dateStr]) {
                            dailyDistribution[dateStr] = { inQty: 0, outQty: 0 };
                        }
                        if (type.includes('in')) dailyDistribution[dateStr].inQty += Math.abs(qty);
                        if (type.includes('out')) dailyDistribution[dateStr].outQty += Math.abs(qty);
                    }

                    return {
                        id: m.id,
                        date: m.created_at,
                        sku: m.item_code || 'N/A',
                        item_name: m.item_name || 'Inventory Item',
                        movement_type: m.movement_type,
                        quantity: qty,
                        reference_type: m.department || 'Warehouse Operations',
                        reference_id: m.reference_number || '—',
                        notes: m.reason || '—',
                    };
                });

                const chartData = Object.entries(dailyDistribution).sort(([a], [b]) => a.localeCompare(b)).map(([date, d]) => ({
                    date,
                    stockIn: d.inQty,
                    stockOut: d.outQty,
                }));

                reportData = {
                    title: 'Confidential Stock Movement Report',
                    summary: `Logistics ledger of all inventory transactions occurred within the reporting window (${periodLabel}). Details inward receipts, outbound fulfillment, adjustments, and vendor returns.`,
                    periodLabel,
                    kpis: [
                        { label: 'Total Movement Events', value: records.length.toLocaleString(), note: 'Transactions logged' },
                        { label: 'Total Units Received (In)', value: stockIn.toLocaleString(), note: 'Procurement & restock' },
                        { label: 'Total Units Issued (Out)', value: stockOut.toLocaleString(), note: 'Dispatched / fulfilled' },
                        { label: 'Inventory Adjustments', value: adjustments, note: 'Cycle count reconciliations' },
                        { label: 'Supplier Returns Logged', value: returns, note: 'Defective / surplus returns' },
                    ],
                    chartData,
                    chartConfig: { type: 'area', xKey: 'date', lines: ['stockIn', 'stockOut'], label: 'Daily Flow' },
                    records,
                };
                break;
            }

            // ==========================================
            // 3. DEFECTIVE ITEMS AND REPLACEMENTS REPORT
            // ==========================================
            case 'defectives-replacements': {
                const [damagesRes, returnsRes] = await Promise.all([
                    supabaseAdmin
                        .from('warehouse_damage_incidents')
                        .select('*')
                        .gte('created_at', startUtc)
                        .lte('created_at', endUtc)
                        .order('created_at', { ascending: false }),

                    supabaseAdmin
                        .from('supplier_return_requests')
                        .select('*')
                        .gte('created_at', startUtc)
                        .lte('created_at', endUtc)
                        .order('created_at', { ascending: false }),
                ]);

                if (damagesRes.error) throw damagesRes.error;
                if (returnsRes.error) throw returnsRes.error;

                const monthDamages = damagesRes.data || [];
                const monthReturns = returnsRes.data || [];

                let totalDefectiveUnits = 0;
                let unresolvedIncidents = 0;
                let resolvedIncidents = 0;
                let replacementsReceived = 0;
                let outstandingReplacements = 0;

                const damageRecords = monthDamages.map((d) => {
                    const qty = Number(d.quantity) || 0;
                    const st = (d.status || '').toLowerCase();
                    totalDefectiveUnits += qty;

                    if (st === 'resolved' || st === 'closed') {
                        resolvedIncidents++;
                    } else {
                        unresolvedIncidents++;
                    }

                    return {
                        id: d.id,
                        type: 'Damage Incident',
                        date: d.reported_at || d.created_at,
                        incident_code: d.incident_number || `INC-${d.id}`,
                        sku: d.item_code || 'N/A',
                        item_name: d.item_name || 'Inventory Item',
                        supplier_name: d.supplier_name || 'N/A',
                        quantity: qty,
                        reason: d.defect_description || d.discrepancy_type || 'Defect observed',
                        severity: d.severity || 'Medium',
                        status: d.status || 'Reported',
                    };
                });

                const returnRecords = monthReturns.map((r) => {
                    const st = (r.status || '').toLowerCase();
                    const res = r.resolution_details || {};
                    const replQty = Number(res.replacement_quantity) || Number(r.defective_quantity) || 0;

                    if (res.replacement_receiving_status === 'Received & Restocked' || res.replacement_receiving_status === 'Received') {
                        replacementsReceived += replQty;
                    } else if (st !== 'completed' && st !== 'resolved') {
                        outstandingReplacements++;
                    }

                    return {
                        id: r.id,
                        type: 'Return / Replacement Claim',
                        date: r.inspection_date || r.created_at,
                        incident_code: r.return_request_number || `SRR-${r.id}`,
                        sku: r.item_code || 'Linked Claim',
                        item_name: r.item_name || 'Supplier Return Claim',
                        supplier_name: r.supplier_name || 'Supplier',
                        quantity: replQty || 1,
                        reason: r.defect_type || r.requested_resolution || 'Supplier Return',
                        severity: res.replacement_receiving_status || 'Pending',
                        status: r.status || 'Under Review',
                    };
                });

                const combinedRecords = [...damageRecords, ...returnRecords];

                reportData = {
                    title: 'Confidential Defective Items and Replacements Report',
                    summary: `Quality assurance and supplier warranty ledger for ${periodLabel}. Tracks damaged shipments, inspection failures, supplier return claims, and replacement fulfillment.`,
                    periodLabel,
                    kpis: [
                        { label: 'Defect Incidents', value: monthDamages.length, note: 'Warehouse damage incidents' },
                        { label: 'Defective Units Affected', value: totalDefectiveUnits.toLocaleString(), status: totalDefectiveUnits > 0 ? 'warning' : 'good', note: 'Units compromised' },
                        { label: 'Replacements Received', value: replacementsReceived.toLocaleString(), note: 'Restocked into usable inventory' },
                        { label: 'Outstanding Replacements', value: outstandingReplacements, status: outstandingReplacements > 0 ? 'warning' : 'good', note: 'Awaiting supplier delivery' },
                        { label: 'Unresolved Incidents', value: unresolvedIncidents, status: unresolvedIncidents > 0 ? 'danger' : 'good', note: 'Pending resolution' },
                    ],
                    records: combinedRecords,
                };
                break;
            }

            // ==========================================
            // 4. PROCUREMENT REPORT
            // ==========================================
            case 'procurement': {
                const { data: requests, error } = await supabaseAdmin
                    .from('purchase_requests')
                    .select('*')
                    .gte('created_at', startUtc)
                    .lte('created_at', endUtc)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                const monthRequests = requests || [];

                let totalEstimatedValue = 0;
                let pendingCount = 0;
                let approvedCount = 0;
                let sourcingCount = 0;
                let rejectedCount = 0;

                const records = monthRequests.map((pr) => {
                    const est = Number(pr.amount) || 0;
                    totalEstimatedValue += est;
                    const st = (pr.status || '').toLowerCase();

                    if (st.includes('pending')) pendingCount++;
                    else if (st.includes('approved')) approvedCount++;
                    else if (st.includes('sourcing') || st.includes('rfq') || st.includes('review')) sourcingCount++;
                    else if (st.includes('rejected')) rejectedCount++;

                    return {
                        id: pr.id,
                        pr_number: pr.request_number || `PR-${pr.id}`,
                        request_date: pr.date || pr.created_at,
                        department: pr.department || 'Operations',
                        priority: pr.priority || 'Normal',
                        status: pr.status || 'Pending',
                        estimated_total: est,
                        requested_by: pr.requested_by || 'Staff',
                        notes: pr.description || '—',
                    };
                });

                reportData = {
                    title: 'Confidential Monthly Procurement Report',
                    summary: `Requisitions and procurement workflow audit for ${periodLabel}. Covers departmental purchasing requests, pipeline status, and budget allocations.`,
                    periodLabel,
                    kpis: [
                        { label: 'Total Requisitions (PRs)', value: records.length, note: 'Submitted in month' },
                        { label: 'Estimated Budget Value', value: `₱${totalEstimatedValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, note: 'Sum of requisition estimates' },
                        { label: 'Approved Requisitions', value: approvedCount, note: 'Ready for Purchase Order creation' },
                        { label: 'Pending Approvals', value: pendingCount, status: pendingCount > 0 ? 'warning' : 'good', note: 'Awaiting executive authorization' },
                        { label: 'In Sourcing / RFQ', value: sourcingCount, note: 'Vendor quotation phase' },
                    ],
                    records,
                };
                break;
            }

            // ==========================================
            // 5. SUPPLIER PERFORMANCE REPORT
            // ==========================================
            case 'suppliers': {
                const [suppliersRes, ordersRes, damagesRes] = await Promise.all([
                    supabaseAdmin.from('suppliers').select('*').order('name', { ascending: true }),
                    supabaseAdmin
                        .from('purchase_orders')
                        .select('id, supplier_id, supplier_name, total_amount, created_at, status')
                        .gte('created_at', startUtc)
                        .lte('created_at', endUtc),
                    supabaseAdmin
                        .from('warehouse_damage_incidents')
                        .select('id, supplier_id, supplier_name, quantity, created_at')
                        .gte('created_at', startUtc)
                        .lte('created_at', endUtc),
                ]);

                if (suppliersRes.error) throw suppliersRes.error;

                const monthOrders = ordersRes.data || [];
                const monthDamages = damagesRes.data || [];

                const supplierMetrics: Record<string, { poCount: number; spend: number; defectCount: number; damagedUnits: number }> = {};

                for (const po of monthOrders) {
                    const sid = String(po.supplier_id || po.supplier_name || '');
                    if (!sid) continue;
                    if (!supplierMetrics[sid]) supplierMetrics[sid] = { poCount: 0, spend: 0, defectCount: 0, damagedUnits: 0 };
                    if ((po.status || '').toLowerCase() !== 'cancelled') {
                        supplierMetrics[sid].poCount++;
                        supplierMetrics[sid].spend += Number(po.total_amount) || 0;
                    }
                }

                for (const d of monthDamages) {
                    const sid = String(d.supplier_id || d.supplier_name || '');
                    if (!sid) continue;
                    if (!supplierMetrics[sid]) supplierMetrics[sid] = { poCount: 0, spend: 0, defectCount: 0, damagedUnits: 0 };
                    supplierMetrics[sid].defectCount++;
                    supplierMetrics[sid].damagedUnits += Number(d.quantity) || 0;
                }

                let activeWithOrders = 0;
                let suppliersWithDefectsCount = 0;

                const records = (suppliersRes.data || []).map((s) => {
                    const sid = String(s.id);
                    const sName = String(s.name || '');
                    const sm = supplierMetrics[sid] || supplierMetrics[sName] || { poCount: 0, spend: 0, defectCount: 0, damagedUnits: 0 };

                    if (sm.poCount > 0) activeWithOrders++;
                    if (sm.defectCount > 0) suppliersWithDefectsCount++;

                    return {
                        id: s.id,
                        company_name: s.name,
                        category: s.category || 'General Supplier',
                        status: s.is_active !== false ? 'Active' : 'Inactive',
                        contact_person: s.contact_person || 'Confidential Contact',
                        email: s.email || '—',
                        monthly_po_count: sm.poCount,
                        monthly_spend: sm.spend,
                        defect_incidents: sm.defectCount,
                        damaged_units: sm.damagedUnits,
                    };
                });

                reportData = {
                    title: 'Confidential Supplier Performance Report',
                    summary: `Vendor activity, commercial commitments, and defect incidence for ${periodLabel}. Evaluates active supplier reliability and order execution.`,
                    periodLabel,
                    kpis: [
                        { label: 'Registered Suppliers', value: records.length, note: 'Approved vendor base' },
                        { label: 'Suppliers with Orders', value: activeWithOrders, note: 'Active purchasing relationships in month' },
                        { label: 'Suppliers with Defect Claims', value: suppliersWithDefectsCount, status: suppliersWithDefectsCount > 0 ? 'warning' : 'good', note: 'Quality claims lodged' },
                    ],
                    records,
                };
                break;
            }

            // ==========================================
            // 6. PURCHASE ORDER REPORT
            // ==========================================
            case 'purchase-orders': {
                const { data: pos, error } = await supabaseAdmin
                    .from('purchase_orders')
                    .select('*')
                    .gte('created_at', startUtc)
                    .lte('created_at', endUtc)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                const monthPOs = pos || [];

                let awaitingDelivery = 0;
                let partiallyReceived = 0;
                let fullyReceived = 0;
                let cancelled = 0;

                const records = monthPOs.map((po) => {
                    const st = (po.status || '').toLowerCase();

                    if (st === 'cancelled') cancelled++;
                    else if (st.includes('partially')) partiallyReceived++;
                    else if (st === 'received' || st === 'completed' || st === 'fulfilled') fullyReceived++;
                    else awaitingDelivery++;

                    return {
                        ...po,
                        id: po.id,
                        po_number: po.po_number || `PO-${po.id}`,
                        order_date: po.created_at,
                        supplier_name: po.supplier_name || 'Vendor',
                        status: po.status || 'Issued',
                        financial_approval: po.financial_approval || 'Pending',
                        total_amount: Number(po.total_amount) || 0,
                        delivery_date: po.delivery_date || '—',
                        paid: Boolean(po.paid),
                    };
                });

                reportData = {
                    title: 'Confidential Purchase Order Report',
                    summary: `Fulfillment and logistics audit of all Purchase Orders issued during ${periodLabel}. Tracks supply chain progression from issuance to full receiving.`,
                    periodLabel,
                    kpis: [
                        { label: 'Total Issued POs', value: records.length, note: 'Created during month' },
                        { label: 'Awaiting Delivery', value: awaitingDelivery, note: 'In transit / supplier pending' },
                        { label: 'Partially Received', value: partiallyReceived, status: partiallyReceived > 0 ? 'warning' : 'neutral', note: 'Split shipments' },
                        { label: 'Fully Received / Fulfilled', value: fullyReceived, note: 'Warehouse verified' },
                        { label: 'Cancelled Orders', value: cancelled, note: 'Voided transactions' },
                    ],
                    records,
                };
                break;
            }

            // ==========================================
            // 7. PURCHASE ORDER FINANCIAL REPORT
            // ==========================================
            case 'po-financial': {
                const { data: pos, error } = await supabaseAdmin
                    .from('purchase_orders')
                    .select('*')
                    .gte('created_at', startUtc)
                    .lte('created_at', endUtc)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                const monthPOs = pos || [];

                let totalCommitments = 0;
                let approvedCommitments = 0;
                let recordedPayments = 0;
                let outstandingPayables = 0;
                let totalDiscounts = 0;
                let totalVat = 0;
                let totalShipping = 0;

                const records = monthPOs.map((po) => {
                    const st = (po.status || '').toLowerCase();
                    const fin = (po.financial_approval || '').toLowerCase();
                    const total = Number(po.total_amount) || 0;
                    const subtotal = Number(po.subtotal) || total;
                    const tax = Number(po.tax_amount) || 0;
                    const disc = Number(po.discount) || 0;
                    const ship = Number(po.shipping_fee) || 0;
                    const isPaid = Boolean(po.paid);

                    if (st !== 'cancelled') {
                        totalCommitments += total;
                        totalDiscounts += disc;
                        totalVat += tax;
                        totalShipping += ship;

                        if (fin === 'approved') approvedCommitments += total;
                        if (isPaid) recordedPayments += total;
                        else outstandingPayables += total;
                    }

                    return {
                        ...po,
                        id: po.id,
                        po_number: po.po_number || `PO-${po.id}`,
                        order_date: po.created_at,
                        supplier_name: po.supplier_name || 'Vendor',
                        supplier_email: po.supplier_email,
                        supplier_phone: po.supplier_phone,
                        supplier_location: po.supplier_location || po.supplier_address,
                        category: po.category,
                        status: po.status,
                        financial_approval: po.financial_approval || 'Pending',
                        financial_approved_at: po.financial_approved_at,
                        admin_approval: po.admin_approval,
                        subtotal,
                        discount: disc,
                        discount_amount: disc,
                        tax_amount: tax,
                        tax_rate: po.tax_rate,
                        shipping_fee: ship,
                        shipping_amount: ship,
                        total_amount: total,
                        paid: isPaid,
                        payment_status: isPaid ? 'Paid' : 'Unpaid / Pending Payable',
                        delivery_date: po.delivery_date,
                        delivery_location: po.delivery_location,
                        payment_terms: po.payment_terms,
                        payment_method: po.payment_method,
                        terms_and_conditions: po.terms_and_conditions,
                        notes: po.notes,
                        items: po.items,
                        created_at: po.created_at,
                        created_by: po.created_by,
                    };
                });

                reportData = {
                    title: 'Confidential Purchase Order Financial Report',
                    summary: `Financial reconciliation of procurement commitments, approved capital, recorded disbursements, and outstanding liabilities for ${periodLabel}. Unpaid POs are distinctly tracked as pending payables.`,
                    periodLabel,
                    kpis: [
                        { label: 'Total Issued Commitments', value: `₱${totalCommitments.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, note: 'Non-cancelled PO gross value' },
                        { label: 'Approved Capital Commitments', value: `₱${approvedCommitments.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, note: 'Executive approved' },
                        { label: 'Recorded Disbursed Payments', value: `₱${recordedPayments.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, note: 'Invoices verified paid' },
                        { label: 'Outstanding Accounts Payable', value: `₱${outstandingPayables.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, status: outstandingPayables > 0 ? 'warning' : 'good', note: 'Pending settlement' },
                        { label: 'Discounts Negotiated', value: `₱${totalDiscounts.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, note: 'Supplier savings' },
                        { label: 'VAT & Shipping Applied', value: `₱${(totalVat + totalShipping).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, note: 'Taxes & freight charges' },
                    ],
                    records,
                };
                break;
            }

            // ==========================================
            // 8. SUPPLY CHAIN CONFIDENTIAL REPORT
            // ==========================================
            case 'confidential-sc': {
                const [adjustmentsRes, disputesRes, auditRes] = await Promise.all([
                    supabaseAdmin
                        .from('stock_movements')
                        .select('*')
                        .ilike('movement_type', '%adjust%')
                        .gte('created_at', startUtc)
                        .lte('created_at', endUtc)
                        .order('created_at', { ascending: false }),

                    supabaseAdmin
                        .from('supplier_return_requests')
                        .select('*')
                        .gte('created_at', startUtc)
                        .lte('created_at', endUtc)
                        .order('created_at', { ascending: false }),

                    supabaseAdmin
                        .from('user_activity')
                        .select('*')
                        .gte('created_at', startUtc)
                        .lte('created_at', endUtc)
                        .order('created_at', { ascending: false }),
                ]);

                const monthAdjustments = adjustmentsRes.data || [];
                const monthDisputes = disputesRes.data || [];
                const monthAudits = auditRes.data || [];

                const records: any[] = [];

                // 1. Stock adjustments & variance records
                for (const adj of monthAdjustments) {
                    records.push({
                        id: `ADJ-${adj.id}`,
                        type: 'Stock Variance / Adjustment',
                        date: adj.created_at,
                        entity: adj.item_name ? `${adj.item_name} (${adj.item_code || 'SKU'})` : `Item #${adj.item_id}`,
                        impact: `${adj.quantity > 0 ? '+' : ''}${adj.quantity} units`,
                        category: 'Inventory Discrepancy',
                        details: adj.reason || 'Discrepancy adjustment recorded in warehouse',
                        status: 'Audited',
                    });
                }

                // 2. Vendor disputes / return warranty claims
                for (const d of monthDisputes) {
                    records.push({
                        id: `DISP-${d.id}`,
                        type: 'Supplier Claim / Return',
                        date: d.created_at,
                        entity: d.supplier_name || 'Vendor',
                        impact: `${d.defective_quantity || 1} units disputed`,
                        category: 'Vendor Dispute',
                        details: `Reason: ${d.defect_type || 'Defective delivery'}. Status: ${d.status}`,
                        status: d.status,
                    });
                }

                // 3. Security & operational audit alerts
                for (const aud of monthAudits) {
                    const act = (aud.action || '').toUpperCase();
                    const desc = (aud.description || '').toUpperCase();
                    if (act.includes('FAILED') || act.includes('UNAUTHORIZED') || act.includes('DISCREPANCY') || act.includes('EXECUTIVE') ||
                        desc.includes('FAILED') || desc.includes('UNAUTHORIZED')) {
                        records.push({
                            id: `AUD-${aud.id}`,
                            type: 'Security & Access Event',
                            date: aud.created_at,
                            entity: `User #${aud.user_id || 'System'}`,
                            impact: 'Access Audit Flag',
                            category: 'Security Governance',
                            details: `Action: ${aud.action}. ${aud.description || ''}`,
                            status: act.includes('FAILED') ? 'Flagged Alert' : 'Logged',
                        });
                    }
                }

                reportData = {
                    title: 'Confidential Supply Chain Audit & Governance Report',
                    summary: `Consolidated internal executive audit report for ${periodLabel}. Discloses forced inventory adjustments, unresolved vendor disputes, defect quarantine allocations, and security access events.`,
                    periodLabel,
                    kpis: [
                        { label: 'Unusual Adjustments Logged', value: monthAdjustments.length, status: monthAdjustments.length > 0 ? 'warning' : 'good', note: 'Inventory variances' },
                        { label: 'Active Vendor Claims', value: monthDisputes.length, status: monthDisputes.length > 0 ? 'warning' : 'good', note: 'Disputed shipments & RMA' },
                        { label: 'Security & Access Flags', value: records.filter((r) => r.category === 'Security Governance').length, note: 'Executive access trail' },
                        { label: 'Total Governance Items', value: records.length, note: 'Requires executive oversight' },
                    ],
                    records,
                };
                break;
            }

            default:
                return NextResponse.json(
                    { success: false, error: `Invalid report category: ${category}` },
                    { status: 400 }
                );
        }

        // Add verification audit metadata
        reportData.metadata = {
            category,
            year,
            month,
            periodLabel,
            cutoffLabel,
            authorizedExecutive: user.display_name,
            executiveEmail: user.email,
            generatedAt: new Date().toISOString(),
        };

        return NextResponse.json({
            success: true,
            report: reportData,
        });
    } catch (err: any) {
        console.error('[Executive Reports Detail] Error:', err);
        return NextResponse.json(
            { success: false, error: 'Internal server error generating confidential report.' },
            { status: 500 }
        );
    }
}
