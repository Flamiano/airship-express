'use client';

import React, { useRef, useState } from 'react';
import Portal from '../client/Portal';
import { toast } from 'sonner';
import { 
    Printer, 
    Copy, 
    Check, 
    X, 
    FileText, 
    ShieldCheck, 
    Building2, 
    Truck, 
    Calendar, 
    Clock, 
    PackageCheck, 
    Download,
    CheckCircle2,
    Sparkles,
    CreditCard,
    BadgeCheck,
    Tag,
    MapPin,
    Receipt,
    Percent,
    FileCheck2,
    Loader2,
    ImageIcon
} from 'lucide-react';

export interface DigitalReceiptData {
    id?: string;
    po_number: string;
    supplier_name?: string;
    supplier_email?: string;
    supplier_phone?: string;
    supplier_location?: string | null;
    supplier_address?: string | null;
    category?: string | null;
    subtotal?: number;
    discount?: number;
    shipping_fee?: number;
    tax_rate?: number;
    tax_amount?: number;
    total_amount: number;
    status: string;
    delivery_date?: string;
    delivery_location?: string | null;
    payment_terms?: string | null;
    payment_method?: string | null;
    terms_and_conditions?: string | null;
    notes?: string;
    items?: Array<{
        name?: string;
        item_name?: string;
        description?: string;
        quantity: number;
        unit_price?: number;
        price?: number;
        total?: number;
    }>;
    created_at?: string;
    created_by?: string;
    paid?: boolean;
    admin_approval?: string;
    admin_approved_by?: string;
    admin_approved_at?: string;
    financial_approval?: string;
    financial_approved_at?: string;
    financial_approved_by?: string;
    verification?: any;
}

export interface DigitalReceiptModalProps {
    isOpen: boolean;
    onClose: () => void;
    order?: DigitalReceiptData | any | null;
    purchaseOrder?: DigitalReceiptData | any | null;
}

export function DigitalReceiptModal({ isOpen, onClose, order: propOrder, purchaseOrder }: DigitalReceiptModalProps) {
    const receiptRef = useRef<HTMLDivElement>(null);
    const [copied, setCopied] = useState(false);
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
    const order = propOrder || purchaseOrder || null;

    if (!isOpen || !order) return null;

    const isFinancialApproved = ((order as any).financial_approval === 'Approved' || order.admin_approval === 'Approved') && 
                                (order as any).financial_approval !== 'Pending' && 
                                order.admin_approval !== 'Pending';

    const approvalDate = (order as any).financial_approved_at
        ? new Date((order as any).financial_approved_at)
        : order.admin_approved_at
            ? new Date(order.admin_approved_at)
            : (order.created_at ? new Date(order.created_at) : new Date());

    const formattedDate = approvalDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
    const formattedTime = approvalDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
    });

    const buyerLocation = order.delivery_location || '352 Escolta St, Binondo, Manila, 1006 Metro Manila (Airship Express Central Logistics Hub)';
    const supplierLocation = (order as any).supplier_location || (order as any).supplier_address || 'On File / Registered Supplier Facility';

    const items = (order.items && order.items.length > 0)
        ? order.items
        : [{
              name: order.notes || 'Purchase Order Items',
              item_name: order.notes || 'Purchase Order Items',
              quantity: 1,
              unit_price: order.total_amount,
              total: order.total_amount,
          }];

    const calculatedSubtotal = items.reduce((sum, it) => {
        const qty = Number(it.quantity) || 1;
        const price = Number(it.unit_price ?? it.price ?? 0);
        return sum + (it.total ? Number(it.total) : qty * price);
    }, 0);

    const subtotal = order.subtotal !== undefined && order.subtotal !== null ? Number(order.subtotal) : calculatedSubtotal;
    const discount = Number(order.discount || 0);
    const shippingFee = Number(order.shipping_fee || 0);
    const taxRate = order.tax_rate !== undefined && order.tax_rate !== null ? Number(order.tax_rate) : 12;
    const taxAmount = order.tax_amount !== undefined && order.tax_amount !== null
        ? Number(order.tax_amount)
        : Math.max(0, (subtotal - discount) * (taxRate / 100));

    const grandTotal = order.total_amount !== undefined && order.total_amount !== null && order.total_amount > 0
        ? Number(order.total_amount)
        : Math.max(0, subtotal - discount + taxAmount + shippingFee);

    const poNum = order.po_number || 'PO-000000';
    const securityCode = `AESC-${poNum.replace(/[^a-zA-Z0-9]/g, '')}-${approvalDate.getTime().toString().slice(-6)}`;

    const getStatusStyle = (status: string) => {
        const s = (status || '').toLowerCase();
        if (s === 'confirmed' || s === 'delivered' || s === 'completed' || s === 'paid') {
            return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700/60 shadow-[inset_1px_1px_3px_rgba(16,185,129,0.2)]';
        }
        if (s === 'sent') {
            return 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-300 dark:border-indigo-700/60 shadow-[inset_1px_1px_3px_rgba(99,102,241,0.2)]';
        }
        if (s === 'approved') {
            return 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-300 dark:border-purple-700/60 shadow-[inset_1px_1px_3px_rgba(168,85,247,0.2)]';
        }
        if (s === 'rejected' || s === 'cancelled') {
            return 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-700/60 shadow-[inset_1px_1px_3px_rgba(244,63,94,0.2)]';
        }
        return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700/60 shadow-[inset_1px_1px_3px_rgba(245,158,11,0.2)]';
    };

    const handlePrint = () => {
        if (!receiptRef.current) {
            window.print();
            return;
        }

        // Create an isolated hidden iframe for printing ONLY the receipt to prevent duplicate 3 pages
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.style.visibility = 'hidden';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document;
        if (!doc) {
            window.print();
            return;
        }

        // Copy styles & link tags from the main document for pixel-perfect printing
        const headStyles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
            .map(el => el.outerHTML)
            .join('\n');

        const receiptHtml = receiptRef.current.outerHTML;

        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="utf-8" />
                <title>Receipt_${order.po_number || 'Order'}</title>
                ${headStyles}
                <style>
                    @page {
                        margin: 10mm;
                        size: auto;
                    }
                    html, body {
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #ffffff !important;
                        color: #0f172a !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        height: auto !important;
                        min-height: 0 !important;
                        overflow: visible !important;
                    }
                    #printable-digital-receipt {
                        position: static !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 auto !important;
                        padding: 16px !important;
                        background: #ffffff !important;
                        color: #0f172a !important;
                        box-shadow: none !important;
                        border: 1px solid #e2e8f0 !important;
                        border-radius: 8px !important;
                    }
                    .receipt-top-accent {
                        display: none !important;
                    }
                    .receipt-brand-accent {
                        color: #db2777 !important;
                        font-weight: 800 !important;
                    }
                    .receipt-official-pill {
                        background-color: #fdf2f8 !important;
                        color: #db2777 !important;
                        border-color: #fbcfe8 !important;
                    }
                    .receipt-section-title {
                        color: #db2777 !important;
                    }
                    .receipt-card {
                        background-color: #fafafa !important;
                        border-color: #e2e8f0 !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    .receipt-table-wrapper {
                        border-color: #cbd5e1 !important;
                        background-color: #ffffff !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    .receipt-table-header {
                        background-color: #fdf2f8 !important;
                        color: #9d174d !important;
                        border-bottom: 2px solid #db2777 !important;
                    }
                    .receipt-table-header th {
                        color: #9d174d !important;
                    }
                    .receipt-grand-total-amount {
                        color: #db2777 !important;
                        font-weight: 900 !important;
                    }
                    .receipt-verified-badge {
                        background-color: #fdf2f8 !important;
                        color: #db2777 !important;
                        border-color: #fbcfe8 !important;
                    }
                    * {
                        box-shadow: none !important;
                        text-shadow: none !important;
                    }
                </style>
            </head>
            <body>
                ${receiptHtml}
            </body>
            </html>
        `);
        doc.close();

        setTimeout(() => {
            try {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
            } catch (e) {
                console.error('Error invoking iframe print:', e);
                window.print();
            } finally {
                setTimeout(() => {
                    if (document.body.contains(iframe)) {
                        document.body.removeChild(iframe);
                    }
                }, 1000);
            }
        }, 300);
    };

    const handleCopyDetails = async () => {
        const text = `================================================
AIRSHIP EXPRESS - OFFICIAL PROCUREMENT DIGITAL RECEIPT
================================================
PO Number: ${order.po_number}
Status: ${order.status.toUpperCase()}
Issue Date: ${isFinancialApproved ? `${formattedDate} at ${formattedTime}` : 'PENDING'}
Security Ref: ${securityCode}
Category: ${order.category || 'General Procurement'}

BUYER DETAILS:
- Entity: Airship Express Logistics Corp.
- Division: Procurement & Fleet Operations
- Location: ${buyerLocation}
- Authorized Signatory: ${order.created_by || 'Authorized Officer'}

SUPPLIER / VENDOR DETAILS:
- Supplier: ${order.supplier_name}
- Location: ${supplierLocation}
- Email/Phone: ${order.supplier_email || order.supplier_phone || 'On File'}
- Expected Delivery: ${order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Standard Schedule'}
- Payment Terms: ${order.payment_terms || 'Net 30 Days (Standard B2B)'}

ITEMIZED BREAKDOWN:
${items.map((i, idx) => `${idx + 1}. ${i.name || i.item_name || 'Item'} (Qty: ${i.quantity}) @ ₱${Number(i.unit_price ?? i.price ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} = ₱${Number(i.total ?? (i.quantity * Number(i.unit_price ?? i.price ?? 0))).toLocaleString(undefined, { minimumFractionDigits: 2 })}`).join('\n')}

------------------------------------------------
FINANCIAL SUMMARY:
- Items Subtotal: ₱${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
${discount > 0 ? `- Discount: -₱${discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` : ''}- Shipping & Handling: ${shippingFee > 0 ? `₱${shippingFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₱0.00 (Included)'}
- Value Added Tax (${taxRate}%): ₱${taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
------------------------------------------------
GRAND TOTAL: ₱${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (PHP)
------------------------------------------------
${order.terms_and_conditions ? `Governing Terms: ${order.terms_and_conditions}\n` : ''}Notes: ${order.notes || 'Official procurement requisition approved for fleet inventory and supply distribution.'}
Verified & Certified by Airship Express Procurement Management System
================================================`;

        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            toast.success('Digital receipt summary copied to clipboard');
            setTimeout(() => setCopied(false), 2500);
        } catch (e) {
            toast.error('Failed to copy receipt');
        }
    };

    const handleDownloadPdf = async () => {
        setIsDownloadingPdf(true);
        const toastId = toast.loading('Generating official PDF receipt...');

        try {
            const { default: jsPDF } = await import('jspdf');
            const autotableModule = await import('jspdf-autotable');
            const autoTable = autotableModule.autoTable || (autotableModule.default as any)?.autoTable || autotableModule.default;

            const doc = new jsPDF({ unit: 'pt', format: 'a4' });
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 40;
            let cursorY = 32;

            // Load logo image as base64 data URL
            const logoBase64 = await new Promise<string | null>((resolve) => {
                try {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = () => {
                        try {
                            const canvas = document.createElement('canvas');
                            canvas.width = img.naturalWidth || 651;
                            canvas.height = img.naturalHeight || 383;
                            const ctx = canvas.getContext('2d');
                            if (!ctx) return resolve(null);
                            ctx.drawImage(img, 0, 0);
                            resolve(canvas.toDataURL('image/png'));
                        } catch {
                            resolve(null);
                        }
                    };
                    img.onerror = () => resolve(null);
                    img.src = '/images/logo-remove-bg.png';
                } catch {
                    resolve(null);
                }
            });

            // (Top border bar removed as requested)

            // Header Title & Logo
            let brandStartX = margin;
            if (logoBase64) {
                try {
                    // Logo aspect ratio is 651:383 (~1.7)
                    const logoH = 28;
                    const logoW = Math.round(logoH * (651 / 383));
                    doc.addImage(logoBase64, 'PNG', margin, cursorY + 2, logoW, logoH);
                    brandStartX = margin + logoW + 10;
                } catch (e) {
                    console.warn('Could not render logo in PDF:', e);
                }
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(18);
            doc.setTextColor(15, 23, 42); // Slate 900
            doc.text('Airship', brandStartX, cursorY + 14);
            
            const airshipWidth = doc.getTextWidth('Airship');
            doc.setTextColor(219, 39, 119); // Pink 600
            doc.text('Express', brandStartX + airshipWidth + 2, cursorY + 14);

            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 116, 139); // Slate 500
            doc.text('SUPPLY CHAIN & PROCUREMENT LOGISTICS HUB', brandStartX, cursorY + 26);

            // Document Type & PO Badge (Right Aligned)
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.setTextColor(15, 23, 42);
            doc.text('DIGITAL PROCUREMENT RECEIPT', pageWidth - margin, cursorY + 12, { align: 'right' });

            doc.setFontSize(10);
            doc.setTextColor(219, 39, 119);
            doc.text(`#${order.po_number || 'PO-000000'}`, pageWidth - margin, cursorY + 24, { align: 'right' });

            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text(`Status: ${(order.status || 'Active').toUpperCase()} · Issued: ${formattedDate} ${formattedTime}`, pageWidth - margin, cursorY + 35, { align: 'right' });

            cursorY += 46;

            // Horizontal Separator
            doc.setDrawColor(226, 232, 240); // Slate 200
            doc.setLineWidth(1);
            doc.line(margin, cursorY, pageWidth - margin, cursorY);
            cursorY += 14;

            // Buyer & Vendor Info Cards (Side by Side)
            const colW = (pageWidth - margin * 2 - 16) / 2;
            const suppX = margin + colW + 16;

            const buyerLocLines = doc.splitTextToSize(`Delivery Hub: ${buyerLocation}`, colW - 24);
            const suppLocLines = doc.splitTextToSize(`Facility: ${supplierLocation}`, colW - 24);

            const buyerTextH = buyerLocLines.length * 9.5;
            const suppTextH = suppLocLines.length * 9.5;
            const cardBoxH = Math.max(90, 58 + Math.max(buyerTextH, suppTextH));

            // Buyer Box
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(margin, cursorY, colW, cardBoxH, 6, 6, 'FD');

            let bY = cursorY + 15;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(219, 39, 119);
            doc.text('BUYER DETAILS (CONSIGNEE)', margin + 12, bY);
            bY += 13;

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(15, 23, 42);
            doc.text('Airship Express Logistics Corp.', margin + 12, bY);
            bY += 12;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(71, 85, 105);
            doc.text(buyerLocLines, margin + 12, bY);
            bY += buyerLocLines.length * 9.5 + 4;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(71, 85, 105);
            doc.text(`Requisitioned By: ${order.created_by || 'Authorized Officer'}`, margin + 12, bY);

            // Supplier Box
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(suppX, cursorY, colW, cardBoxH, 6, 6, 'FD');

            let sBoxY = cursorY + 15;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(219, 39, 119);
            doc.text('SUPPLIER / VENDOR', suppX + 12, sBoxY);
            sBoxY += 13;

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(15, 23, 42);
            doc.text(order.supplier_name || 'Registered Supplier', suppX + 12, sBoxY);
            sBoxY += 12;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(71, 85, 105);
            doc.text(suppLocLines, suppX + 12, sBoxY);
            sBoxY += suppLocLines.length * 9.5 + 4;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(71, 85, 105);
            doc.text(`Contact: ${order.supplier_email || order.supplier_phone || 'On file'}`, suppX + 12, sBoxY);

            cursorY += cardBoxH + 12;

            // Metadata Bar (Category, Terms, Delivery) - clean 3 equal bounded cells
            const totalMetaW = pageWidth - margin * 2;
            const metaColW = totalMetaW / 3;
            const metaBarH = 26;

            doc.setFillColor(241, 245, 249);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(margin, cursorY, totalMetaW, metaBarH, 4, 4, 'FD');

            // Col 1: Category
            const c1X = margin + 10;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(100, 116, 139);
            doc.text('CATEGORY:', c1X, cursorY + 16);
            const catLabelW = doc.getTextWidth('CATEGORY:') + 4;
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(15, 23, 42);
            const catVal = order.category || 'General Procurement';
            const catTruncated = doc.splitTextToSize(catVal, metaColW - catLabelW - 14)[0] || catVal;
            doc.text(catTruncated, c1X + catLabelW, cursorY + 16);

            // Col 2: Payment Terms
            const c2X = margin + metaColW + 10;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(100, 116, 139);
            doc.text('TERMS:', c2X, cursorY + 16);
            const termsLabelW = doc.getTextWidth('TERMS:') + 4;
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(15, 23, 42);
            const termsVal = order.payment_terms || 'Net 30 Days';
            const termsTruncated = doc.splitTextToSize(termsVal, metaColW - termsLabelW - 14)[0] || termsVal;
            doc.text(termsTruncated, c2X + termsLabelW, cursorY + 16);

            // Col 3: Delivery
            const c3X = margin + metaColW * 2 + 10;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(100, 116, 139);
            doc.text('DELIVERY:', c3X, cursorY + 16);
            const delivLabelW = doc.getTextWidth('DELIVERY:') + 4;
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(15, 23, 42);
            const delivVal = order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Standard Schedule';
            const delivTruncated = doc.splitTextToSize(delivVal, metaColW - delivLabelW - 14)[0] || delivVal;
            doc.text(delivTruncated, c3X + delivLabelW, cursorY + 16);

            cursorY += metaBarH + 12;

            // Itemized Table
            const tableHead = [['#', 'ITEM & SPECIFICATION', 'QTY', 'UNIT PRICE (PHP)', 'TOTAL (PHP)']];
            const tableBody = items.map((it, idx) => [
                String(idx + 1),
                it.name || it.item_name || 'Purchase Order Item',
                String(it.quantity || 1),
                `PHP ${Number(it.unit_price ?? it.price ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                `PHP ${Number(it.total ?? ((it.quantity || 1) * Number(it.unit_price ?? it.price ?? 0))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            ]);

            let finalY = cursorY;
            autoTable(doc, {
                startY: cursorY,
                head: tableHead,
                body: tableBody,
                margin: { left: margin, right: margin },
                theme: 'grid',
                headStyles: {
                    fillColor: [219, 39, 119],
                    textColor: [255, 255, 255],
                    font: 'helvetica',
                    fontStyle: 'bold',
                    fontSize: 8,
                    cellPadding: 5,
                },
                styles: {
                    font: 'helvetica',
                    fontSize: 8,
                    cellPadding: 5,
                    textColor: [30, 41, 59],
                    lineColor: [226, 232, 240],
                    lineWidth: 0.5,
                    overflow: 'linebreak',
                },
                alternateRowStyles: {
                    fillColor: [248, 250, 252],
                },
                columnStyles: {
                    0: { cellWidth: 24, halign: 'center' },
                    1: { cellWidth: 'auto' },
                    2: { cellWidth: 38, halign: 'center' },
                    3: { cellWidth: 100, halign: 'right' },
                    4: { cellWidth: 100, halign: 'right' },
                },
                didDrawPage: (hook: any) => {
                    finalY = hook.cursor?.y ?? finalY;
                },
            });

            cursorY = finalY + 14;

            // Bottom Section: Left Card (Security/Certification) & Right Card (Financial Summary)
            const summaryW = 230;
            const summaryX = pageWidth - margin - summaryW;
            const leftCardW = summaryX - margin - 14;

            const certNote = 'Certified electronic procurement receipt generated by Airship Express Procurement Management System. Valid for audit, inventory reconciliation, and accounting clearance.';
            const certLines = doc.splitTextToSize(certNote, leftCardW - 20);

            const notesText = order.notes ? `Notes: ${order.notes}` : '';
            const notesLines = notesText ? doc.splitTextToSize(notesText, leftCardW - 20) : [];

            const leftCardH = 46 + (certLines.length * 9) + (notesLines.length > 0 ? (notesLines.length * 9 + 6) : 0);
            const summaryH = discount > 0 ? 112 : 98;
            const bottomSectionH = Math.max(leftCardH, summaryH);

            // Page break check for bottom section
            if (cursorY + bottomSectionH > pageHeight - 35) {
                doc.addPage();
                cursorY = 40;
            }

            // Left Card: Security & Audit
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(margin, cursorY, leftCardW, bottomSectionH, 6, 6, 'FD');

            let leftY = cursorY + 15;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text('SECURITY VERIFICATION CODE', margin + 10, leftY);
            leftY += 13;

            doc.setFont('courier', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(219, 39, 119);
            doc.text(securityCode, margin + 10, leftY);
            leftY += 14;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(100, 116, 139);
            doc.text(certLines, margin + 10, leftY);
            leftY += certLines.length * 9 + 6;

            if (notesLines.length > 0) {
                doc.setFont('helvetica', 'italic');
                doc.setFontSize(7.5);
                doc.setTextColor(71, 85, 105);
                doc.text(notesLines, margin + 10, leftY);
            }

            // Right Card: Financial Summary
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(summaryX, cursorY, summaryW, bottomSectionH, 6, 6, 'FD');

            const sLeft = summaryX + 12;
            const sRight = summaryX + summaryW - 12;
            let sY = cursorY + 15;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text('Subtotal:', sLeft, sY);
            doc.setTextColor(15, 23, 42);
            doc.text(`PHP ${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, sRight, sY, { align: 'right' });
            sY += 13;

            if (discount > 0) {
                doc.setTextColor(100, 116, 139);
                doc.text('Discount:', sLeft, sY);
                doc.setTextColor(225, 29, 72);
                doc.text(`-PHP ${discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, sRight, sY, { align: 'right' });
                sY += 13;
            }

            doc.setTextColor(100, 116, 139);
            doc.text('Shipping & Handling:', sLeft, sY);
            doc.setTextColor(15, 23, 42);
            doc.text(shippingFee > 0 ? `PHP ${shippingFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'PHP 0.00 (Included)', sRight, sY, { align: 'right' });
            sY += 13;

            doc.setTextColor(100, 116, 139);
            doc.text(`Value Added Tax (${taxRate}%):`, sLeft, sY);
            doc.setTextColor(15, 23, 42);
            doc.text(`PHP ${taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, sRight, sY, { align: 'right' });
            sY += 16;

            doc.setDrawColor(219, 39, 119);
            doc.setLineWidth(1);
            doc.line(sLeft, sY - 4, sRight, sY - 4);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9.5);
            doc.setTextColor(15, 23, 42);
            doc.text('GRAND TOTAL:', sLeft, sY + 8);
            doc.setTextColor(219, 39, 119);
            doc.setFontSize(11);
            doc.text(`PHP ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, sRight, sY + 8, { align: 'right' });

            // Footer pagination
            const pageCount = doc.getNumberOfPages();
            for (let p = 1; p <= pageCount; p++) {
                doc.setPage(p);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7.5);
                doc.setTextColor(148, 163, 184);
                doc.text('Airship Express · Official Digital Procurement Receipt', margin, pageHeight - 18);
                doc.text(`Page ${p} of ${pageCount}`, pageWidth - margin, pageHeight - 18, { align: 'right' });
            }

            const poClean = (order.po_number || 'order').replace(/[^a-zA-Z0-9_-]/g, '_');
            doc.save(`receipt_${poClean}.pdf`);

            toast.success('Official PDF receipt downloaded successfully', { id: toastId });
            setIsDownloadingPdf(false);
        } catch (err: any) {
            console.error('Failed to generate PDF receipt:', err);
            toast.error('Failed to export PDF receipt: ' + (err?.message || 'Error creating PDF document'), { id: toastId });
            setIsDownloadingPdf(false);
        }
    };

    return (
        <Portal>
            <div
                className="fixed inset-0 bg-slate-950/70 dark:bg-black/85 backdrop-blur-md flex items-center justify-center z-[999999] p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200"
                onClick={onClose}
            >
                {/* Neumorphic Outer Card Container */}
                <div
                    className="bg-[#f0f3f8] dark:bg-[#191a24] rounded-3xl max-w-3xl w-full my-auto border border-slate-200/80 dark:border-[#2c2d3c] shadow-none overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Action Bar Header */}
                    <div className="print:hidden px-5 sm:px-6 py-4 border-b border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/40 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-pink-600 border border-pink-400/80 text-white flex items-center justify-center shadow-[3px_3px_7px_rgba(219,39,119,0.35),inset_0_1px_1.5px_rgba(255,255,255,0.4)]">
                                <FileText className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                                        Digital Procurement Receipt
                                    </h3>
                                    <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-100 dark:bg-pink-950/80 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-900/50">
                                        Official
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <p className="text-xs font-mono font-bold text-pink-600 dark:text-pink-400">
                                        #{order.po_number}
                                    </p>
                                    {order.category && (
                                        <span className="text-[10px] font-semibold px-2 py-0.2 rounded-md bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                            {order.category}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Copy Details Button */}
                            <button
                                type="button"
                                onClick={handleCopyDetails}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-[#ebf0f7] hover:bg-[#e4ebf5] dark:bg-[#1e1f2c] dark:hover:bg-[#252738] border border-white/80 dark:border-white/[0.08] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)] active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                                title="Copy receipt summary"
                            >
                                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />}
                                <span>{copied ? 'Copied' : 'Copy'}</span>
                            </button>

                            {/* Download PDF Button */}
                            <button
                                type="button"
                                onClick={handleDownloadPdf}
                                disabled={isDownloadingPdf}
                                className="inline-flex px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-[#ebf0f7] hover:bg-[#e4ebf5] dark:bg-[#1e1f2c] dark:hover:bg-[#252738] border border-white/80 dark:border-white/[0.08] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)] active:scale-95 transition-all items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                title="Download official PDF receipt (.pdf)"
                            >
                                {isDownloadingPdf ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-pink-600 dark:text-pink-400" />
                                ) : (
                                    <Download className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                                )}
                                <span>{isDownloadingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
                            </button>

                            {/* Print / PDF Button */}
                            <button
                                type="button"
                                onClick={handlePrint}
                                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-pink-600 hover:bg-pink-500 border border-pink-400/80 shadow-[3px_3px_7px_rgba(219,39,119,0.35),inset_0_1px_1.5px_rgba(255,255,255,0.4),inset_0_-2px_4px_rgba(0,0,0,0.2)] active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                                title="Print or save as PDF"
                            >
                                <Printer className="h-3.5 w-3.5" />
                                <span>Print / PDF</span>
                            </button>

                            {/* Close Button */}
                            <button
                                type="button"
                                onClick={onClose}
                                className="w-8 h-8 rounded-full bg-[#f0f3f8] dark:bg-[#14151c] hover:bg-[#e4ebf5] dark:hover:bg-[#232533] text-slate-600 dark:text-slate-300 border border-white/80 dark:border-slate-700/70 shadow-[2px_2px_5px_rgba(166,175,195,0.3),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)] flex items-center justify-center transition-all cursor-pointer ml-1 active:scale-95"
                                aria-label="Close"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {/* Scrollable Receipt Canvas */}
                    <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-[#ebf0f7] dark:bg-[#14151c] custom-scrollbar">
                        <div
                            ref={receiptRef}
                            id="printable-digital-receipt"
                            className="bg-[#f0f3f8] dark:bg-[#181926] text-slate-900 dark:text-slate-100 rounded-3xl border border-white/90 dark:border-white/[0.08] shadow-[6px_6px_18px_rgba(166,175,195,0.35),-6px_-6px_18px_rgba(255,255,255,0.95)] dark:shadow-[6px_6px_20px_rgba(0,0,0,0.6)] font-sans relative overflow-hidden print:p-0 print:border-none print:shadow-none print:bg-white print:text-black transition-all"
                        >
                            <div className="p-6 sm:p-8 space-y-6">
                                {/* Header: Brand, Title, Status */}
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/80 dark:border-slate-800/80 receipt-header-border">
                                    <div className="flex items-center gap-3.5">
                                        {/* Neumorphic Sunken Logo Box */}
                                        <div className="w-12 h-12 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-white/80 dark:border-white/[0.06] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] flex items-center justify-center p-2.5 shrink-0 receipt-logo-box">
                                            <img
                                                src="/images/logo-remove-bg.png"
                                                alt="Airship Express"
                                                className="w-full h-full object-contain dark:brightness-0 dark:invert"
                                            />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-white leading-tight receipt-brand">
                                                    Airship<span className="text-pink-600 font-extrabold receipt-brand-accent">Express</span>
                                                </span>
                                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-950/80 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-900/50 receipt-official-pill">
                                                    Official Digital Receipt
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                                Supply Chain & Procurement Management
                                            </p>
                                        </div>
                                    </div>

                                    <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${getStatusStyle(order.status)}`}>
                                                {order.status}
                                            </span>
                                            <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100 bg-[#ebf0f7] dark:bg-[#14151c] px-3 py-1 rounded-full border border-white/80 dark:border-white/[0.06] shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)] receipt-po-badge">
                                                #{order.po_number}
                                            </span>
                                        </div>
                                        {isFinancialApproved ? (
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5 sm:mt-1">
                                                <Clock className="h-3 w-3 inline text-pink-500" />
                                                <span>{formattedDate} · {formattedTime}</span>
                                            </p>
                                        ) : (
                                            <div className="text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800/80 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 sm:mt-1 shadow-xs">
                                                <Clock className="h-3 w-3 text-amber-500 animate-pulse" />
                                                <span>Pending</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Category & Terms Banner Bar (if available) */}
                                {(order.category || order.payment_terms || order.delivery_location) && (
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-[#ebf0f7]/80 dark:bg-[#14151c]/80 border border-slate-200/60 dark:border-slate-800/80 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.5)] text-xs">
                                        <div className="flex items-center gap-2">
                                            <Tag className="h-3.5 w-3.5 text-pink-600 dark:text-pink-400 shrink-0" />
                                            <div className="min-w-0">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Category</span>
                                                <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                                                    {order.category || 'General Procurement'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <CreditCard className="h-3.5 w-3.5 text-pink-600 dark:text-pink-400 shrink-0" />
                                            <div className="min-w-0">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Payment Terms</span>
                                                <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                                                    {order.payment_terms || 'Net 30 Days'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <MapPin className="h-3.5 w-3.5 text-pink-600 dark:text-pink-400 shrink-0" />
                                            <div className="min-w-0">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Delivery Location</span>
                                                <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                                                    {buyerLocation}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Buyer & Supplier Cards Grid (Sunken Inset Panels) */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Buyer Entity Card */}
                                    <div className="bg-[#ebf0f7] dark:bg-[#14151c] p-4.5 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.3),inset_-2px_-2px_5px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] receipt-card">
                                        <div className="flex items-center gap-2 mb-2 text-pink-600 dark:text-pink-400 receipt-section-title">
                                            <Building2 className="h-4 w-4" />
                                            <span className="text-[10.5px] font-extrabold uppercase tracking-wider">Buyer (Issuer)</span>
                                        </div>
                                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                            Airship Express Logistics Corp.
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                            Procurement Department · Fleet Division
                                        </p>
                                        <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
                                            <MapPin className="h-3.5 w-3.5 text-pink-500 shrink-0 mt-0.5" />
                                            <span className="leading-tight">
                                                <strong className="text-slate-700 dark:text-slate-300">Location:</strong> {buyerLocation}
                                            </span>
                                        </div>
                                        <div className="mt-3 pt-2.5 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                                            <span className="text-[11px]">Authorized Signatory:</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[160px]">
                                                {order.created_by || 'Procurement Officer'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Supplier / Vendor Card */}
                                    <div className="bg-[#ebf0f7] dark:bg-[#14151c] p-4.5 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.3),inset_-2px_-2px_5px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] receipt-card">
                                        <div className="flex items-center gap-2 mb-2 text-pink-600 dark:text-pink-400 receipt-section-title">
                                            <Truck className="h-4 w-4" />
                                            <span className="text-[10.5px] font-extrabold uppercase tracking-wider">Supplier / Vendor</span>
                                        </div>
                                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                            {order.supplier_name || 'Registered Supplier'}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono truncate">
                                            {order.supplier_email || order.supplier_phone || 'Verified Supplier'}
                                        </p>
                                        <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
                                            <MapPin className="h-3.5 w-3.5 text-pink-500 shrink-0 mt-0.5" />
                                            <span className="leading-tight truncate" title={supplierLocation}>
                                                <strong className="text-slate-700 dark:text-slate-300">Location:</strong> {supplierLocation}
                                            </span>
                                        </div>
                                        <div className="mt-3 pt-2.5 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                                            <span className="flex items-center gap-1.5 text-[11px]">
                                                <Calendar className="h-3.5 w-3.5 text-pink-500" />
                                                <span>Expected Delivery:</span>
                                            </span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">
                                                {order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Standard Schedule'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Itemized Line Items Table */}
                                <div className="space-y-2.5 pt-1">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold text-xs uppercase tracking-wider">
                                            <PackageCheck className="h-4 w-4 text-pink-600 dark:text-pink-400" />
                                            <span>Purchased Line Items</span>
                                        </div>
                                        <span className="text-xs font-bold text-pink-600 dark:text-pink-400 px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-950/80 border border-pink-200 dark:border-pink-900/50">
                                            {items.length} {items.length === 1 ? 'item' : 'items'}
                                        </span>
                                    </div>

                                    {/* Neumorphic Table Wrapper */}
                                    <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.3),inset_-2px_-2px_5px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] receipt-table-wrapper">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead>
                                                <tr className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white/50 dark:bg-white/[0.02] text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 receipt-table-header">
                                                    <th className="py-3 px-3.5 w-12 text-center">#</th>
                                                    <th className="py-3 px-3.5">Item Description</th>
                                                    <th className="py-3 px-3.5 text-center w-20">Qty</th>
                                                    <th className="py-3 px-3.5 text-right w-32">Unit Price</th>
                                                    <th className="py-3 px-3.5 text-right w-36">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300 receipt-table-body">
                                                {items.map((item, idx) => {
                                                    const qty = Number(item.quantity) || 1;
                                                    const unitPrice = Number(item.unit_price ?? item.price ?? 0);
                                                    const total = item.total ? Number(item.total) : qty * unitPrice;

                                                    return (
                                                        <tr key={idx} className="hover:bg-white/40 dark:hover:bg-white/[0.02] transition-colors">
                                                            <td className="py-3 px-3.5 text-center text-slate-400 font-mono text-xs">
                                                                {idx + 1}
                                                            </td>
                                                            <td className="py-3 px-3.5">
                                                                <p className="font-bold text-slate-900 dark:text-white">
                                                                    {item.name || item.item_name || 'Inventory Item'}
                                                                </p>
                                                                {item.description && (
                                                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                                        {item.description}
                                                                    </p>
                                                                )}
                                                            </td>
                                                            <td className="py-3 px-3.5 text-center">
                                                                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-white/70 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border border-white/60 dark:border-white/[0.04] shadow-[1px_1px_2px_rgba(166,175,195,0.3)] dark:shadow-[1px_1px_2px_rgba(0,0,0,0.5)]">
                                                                    {qty}
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-3.5 text-right font-mono text-slate-600 dark:text-slate-400">
                                                                ₱{unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                            <td className="py-3 px-3.5 text-right font-mono font-black text-slate-900 dark:text-white">
                                                                ₱{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Financial Summary & Notes Panel */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch pt-1">
                                    {/* Order Notes / Terms */}
                                    <div className="bg-[#ebf0f7] dark:bg-[#14151c] p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.3),inset_-2px_-2px_5px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] text-xs flex flex-col justify-between receipt-card">
                                        <div className="space-y-3">
                                            <div>
                                                <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                                                    Requisition Notes
                                                </span>
                                                <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-normal text-xs">
                                                    {order.notes || 'Official procurement requisition approved for fleet inventory and supply distribution.'}
                                                </p>
                                            </div>

                                            {order.terms_and_conditions && (
                                                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/80">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                                                        Governing Terms & Conditions
                                                    </span>
                                                    <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                                                        {order.terms_and_conditions}
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                            <div className="flex items-center gap-1.5">
                                                <CreditCard className="h-3.5 w-3.5 text-pink-500" />
                                                <span>Terms: <strong>{order.payment_terms || 'Net 30 Days'}</strong></span>
                                            </div>
                                            {order.payment_method && (
                                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                                    {order.payment_method}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Calculated Totals Box */}
                                    <div className="bg-[#ebf0f7] dark:bg-[#14151c] p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.3),inset_-2px_-2px_5px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] space-y-2.5 text-xs flex flex-col justify-between receipt-card receipt-totals-box">
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400 text-xs">
                                                <span>Items Subtotal</span>
                                                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                                    ₱{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>

                                            {discount > 0 && (
                                                <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                                                    <span>Supplier Discount</span>
                                                    <span className="font-mono">
                                                        -₱{discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                            )}

                                            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400 text-xs">
                                                <span>Shipping & Logistics</span>
                                                <span className={`font-mono font-bold ${shippingFee > 0 ? 'text-slate-800 dark:text-slate-200' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                    {shippingFee > 0 ? `₱${shippingFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₱0.00 (Included)'}
                                                </span>
                                            </div>

                                            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400 text-xs">
                                                <span>Value Added Tax (VAT {taxRate}%)</span>
                                                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                                    ₱{taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Grand Total Row */}
                                        <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 flex justify-between items-baseline receipt-grand-total-row">
                                            <div>
                                                <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider block">
                                                    Grand Total
                                                </span>
                                                <span className="text-[10px] font-bold text-pink-600 dark:text-pink-400">
                                                    PHP (VAT & Shipping Inc.)
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <span className="font-mono text-2xl font-black text-pink-600 dark:text-pink-400 tracking-tight receipt-grand-total-amount">
                                                    ₱{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Security Verification & Signatures */}
                                <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs receipt-footer-border">
                                    {/* Digital Authentication */}
                                    <div className="flex items-center gap-3 bg-[#ebf0f7] dark:bg-[#14151c] p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-[inset_2px_2px_4px_rgba(166,175,195,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] receipt-card">
                                        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-300/80 dark:border-emerald-800/60 shadow-[inset_1px_1px_2px_rgba(16,185,129,0.3)]">
                                            <ShieldCheck className="h-5 w-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-bold text-xs text-slate-900 dark:text-white">
                                                    Digitally Certified
                                                </span>
                                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                            </div>
                                            <p className="text-[9.5px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                                                Security Verification Code
                                            </p>
                                            <p 
                                                className="text-[10.5px] font-mono font-bold text-pink-600 dark:text-pink-400 truncate mt-0.5 cursor-help"
                                                title="Tamper-proof audit hash: [AESC = Airship Express Supply Chain] - [PO Number] - [Approval Timestamp]"
                                            >
                                                {securityCode}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Signatory Stamp */}
                                    <div className="flex items-center justify-between bg-[#ebf0f7] dark:bg-[#14151c] p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-[inset_2px_2px_4px_rgba(166,175,195,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] receipt-card">
                                        <div>
                                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                                Authorized Officer
                                            </span>
                                            <p className="font-bold text-xs text-slate-900 dark:text-slate-100 mt-0.5 truncate max-w-[150px]">
                                                {order.created_by || 'Procurement Executive'}
                                            </p>
                                        </div>
                                        <div className="px-2.5 py-1 rounded-full bg-pink-100 dark:bg-pink-950/80 border border-pink-300 dark:border-pink-900/60 text-pink-700 dark:text-pink-300 font-mono text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_4px_rgba(219,39,119,0.2)] receipt-verified-badge">
                                            VERIFIED
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom Barcode & Branding Footer */}
                                <div className="pt-4 border-t border-slate-200/60 dark:border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10.5px] text-slate-400">
                                    <div className="font-mono tracking-widest text-[9px] uppercase font-bold text-slate-400/80">
                                        ||| | |||| || ||||| |||| || |||| | ||||| || |||
                                    </div>
                                    <div className="text-center sm:text-right font-medium">
                                        Airship Express Procurement & Logistics Platform
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="print:hidden px-6 py-3.5 border-t border-slate-200/60 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/40 flex items-center justify-between shrink-0">
                        <span className="text-xs text-slate-400 font-medium">
                            Press <kbd className="px-2 py-0.5 rounded-lg bg-[#ebf0f7] dark:bg-[#14151c] font-mono text-[10px] border border-white/80 dark:border-white/[0.08] shadow-[1px_1px_2px_rgba(166,175,195,0.3)]">Esc</kbd> to close
                        </span>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2 rounded-full text-xs font-bold text-slate-700 dark:text-slate-200 bg-[#f0f3f8] dark:bg-[#14151c] hover:bg-[#e4ebf5] dark:hover:bg-[#232533] border border-white/90 dark:border-slate-700/80 shadow-[3px_3px_6px_rgba(166,175,195,0.35),-3px_-3px_6px_rgba(255,255,255,0.95)] dark:shadow-[3px_3px_7px_rgba(0,0,0,0.5)] transition-all cursor-pointer active:scale-95"
                        >
                            Close Receipt
                        </button>
                    </div>
                </div>
            </div>

            {/* Print & PDF Styling: Clean 1-Page Layout without duplicate pages */}
            <style jsx global>{`
                @media print {
                    @page {
                        margin: 10mm;
                        size: auto;
                    }
                    /* Hide everything outside of the active portal/modal */
                    body > *:not(.supplychain-container) {
                        display: none !important;
                    }
                    /* Reset all fixed positioning on modal ancestors to prevent repetition across multiple pages */
                    .supplychain-container,
                    .supplychain-container div[class*="fixed"],
                    .supplychain-container .fixed {
                        position: static !important;
                        inset: auto !important;
                        width: 100% !important;
                        height: auto !important;
                        min-height: 0 !important;
                        max-height: none !important;
                        overflow: visible !important;
                        background: transparent !important;
                        backdrop-filter: none !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        box-shadow: none !important;
                    }
                    body * {
                        visibility: hidden !important;
                    }
                    #printable-digital-receipt, #printable-digital-receipt * {
                        visibility: visible !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    #printable-digital-receipt {
                        position: relative !important;
                        left: auto !important;
                        top: auto !important;
                        width: 100% !important;
                        margin: 0 auto !important;
                        padding: 16px !important;
                        background: #ffffff !important;
                        color: #0f172a !important;
                        box-shadow: none !important;
                        border: 1px solid #e2e8f0 !important;
                        border-radius: 8px !important;
                    }
                    .receipt-top-accent {
                        display: none !important;
                    }
                    .receipt-brand-accent {
                        color: #db2777 !important;
                        font-weight: 800 !important;
                    }
                    .receipt-official-pill {
                        background-color: #fdf2f8 !important;
                        color: #db2777 !important;
                        border-color: #fbcfe8 !important;
                    }
                    .receipt-section-title {
                        color: #db2777 !important;
                    }
                    .receipt-card {
                        background-color: #fafafa !important;
                        border-color: #e2e8f0 !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    .receipt-table-wrapper {
                        border-color: #cbd5e1 !important;
                        background-color: #ffffff !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    .receipt-table-header {
                        background-color: #fdf2f8 !important;
                        color: #9d174d !important;
                        border-bottom: 2px solid #db2777 !important;
                    }
                    .receipt-table-header th {
                        color: #9d174d !important;
                    }
                    .receipt-grand-total-amount {
                        color: #db2777 !important;
                        font-weight: 900 !important;
                    }
                    .receipt-verified-badge {
                        background-color: #fdf2f8 !important;
                        color: #db2777 !important;
                        border-color: #fbcfe8 !important;
                    }
                    * {
                        box-shadow: none !important;
                        text-shadow: none !important;
                    }
                }
            `}</style>
        </Portal>
    );
}

