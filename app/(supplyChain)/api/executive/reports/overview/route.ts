import { NextRequest, NextResponse } from 'next/server';
import {
    validateExecutiveSession,
    getManilaMonthRange,
} from '../authHelper';

export async function GET(req: NextRequest) {
    try {
        // 1. Optional session check (Non-blocking for overview metadata: confidential figures require password verification in /detail)
        const authResult = await validateExecutiveSession(req);
        const isAuthenticated = !authResult.errorResponse;

        // 2. Parse reporting month and year
        const { searchParams } = new URL(req.url);
        const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10);
        const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1), 10);

        const range = getManilaMonthRange(year, month);
        const { periodLabel, cutoffLabel } = range;

        // Confidential Report Categories Overview:
        // By design, overview cards show metadata, scope, and covered metrics ONLY.
        // Confidential figures and operational records are released strictly after Executive password verification.
        const categories = [
            {
                id: 'inventory',
                title: 'Inventory Report',
                description: 'Usable stock balances, valuation, and stock health thresholds.',
                badge: 'Operational',
                indicators: [
                    'Tracked Inventory Items',
                    'Usable Stock Balance',
                    'Inventory Valuation',
                    'Low-Stock Threshold Alerts',
                    'Out-of-Stock SKUs',
                    'Quarantined Defective Stock',
                ],
                periodNote: cutoffLabel,
            },
            {
                id: 'stock-movements',
                title: 'Stock Movement Report',
                description: 'Inbound receipts, outbound issuance, adjustments, and supplier returns.',
                badge: 'Logistics',
                indicators: [
                    'Total Movement Transactions',
                    'Stock Received Units',
                    'Stock Issued Units',
                    'Cycle Count Adjustments',
                    'Recorded Supplier Returns',
                ],
                periodNote: periodLabel,
            },
            {
                id: 'defectives-replacements',
                title: 'Defective Items and Replacements Report',
                description: 'Damaged shipments, supplier replacement claims, and fulfillment status.',
                badge: 'Quality Assurance',
                indicators: [
                    'Warehouse Damage Incidents',
                    'Affected Defective Units',
                    'Replacements Received & Restocked',
                    'Outstanding Replacement Claims',
                    'Unresolved Defect Investigations',
                ],
                periodNote: periodLabel,
            },
            {
                id: 'procurement',
                title: 'Procurement Report',
                description: 'Purchase requests, departmental requisitions, and sourcing status.',
                badge: 'Procurement',
                indicators: [
                    'Total Purchase Requests',
                    'Estimated Requisition Budget',
                    'Approved Requisitions',
                    'Pending Executive Approvals',
                    'Vendor Sourcing & RFQ Status',
                ],
                periodNote: periodLabel,
            },
            {
                id: 'suppliers',
                title: 'Supplier Performance Report',
                description: 'Active vendor engagement, procurement spend, and defect incidence.',
                badge: 'Vendor Management',
                indicators: [
                    'Registered Supplier Directory',
                    'Suppliers with Active Monthly Orders',
                    'Suppliers with Defect / Quality Claims',
                    'Vendor Reliability Indicators',
                ],
                periodNote: periodLabel,
            },
            {
                id: 'purchase-orders',
                title: 'Purchase Order Report',
                description: 'Issued purchase orders and delivery fulfillment stages.',
                badge: 'Purchasing',
                indicators: [
                    'Total Issued Purchase Orders',
                    'Orders Awaiting Delivery',
                    'Partially Received Orders',
                    'Fully Received / Fulfilled POs',
                    'Cancelled / Voided Orders',
                ],
                periodNote: periodLabel,
            },
            {
                id: 'po-financial',
                title: 'Purchase Order Financial Report',
                description: 'Gross commitments, disbursements, tax, discounts, and accounts payable.',
                badge: 'Financial Audit',
                indicators: [
                    'Total Issued Commitments',
                    'Approved Capital Commitments',
                    'Recorded Disbursed Payments',
                    'Outstanding Accounts Payable',
                    'Negotiated Discounts Savings',
                    'Applicable VAT & Freight Charges',
                ],
                periodNote: periodLabel,
            },
            {
                id: 'confidential-sc',
                title: 'Supply Chain Confidential Report',
                description: 'Operational variances, unusual adjustments, disputes, and access audit anomalies.',
                badge: 'Confidential Internal Audit',
                indicators: [
                    'Warehouse Stock Variances',
                    'Unusual / Forced Inventory Adjustments',
                    'Active Vendor RMA Disputes',
                    'Security & Access Governance Alerts',
                ],
                periodNote: periodLabel,
            },
        ];

        return NextResponse.json({
            success: true,
            period: {
                year: range.year,
                month: range.month,
                monthName: range.monthName,
                periodLabel: range.periodLabel,
                cutoffLabel: range.cutoffLabel,
            },
            totalCategories: categories.length,
            categories,
        });
    } catch (err: any) {
        console.error('[Executive Reports Overview] Error:', err);
        return NextResponse.json(
            { success: false, error: 'Internal server error aggregating report overview.' },
            { status: 500 }
        );
    }
}
