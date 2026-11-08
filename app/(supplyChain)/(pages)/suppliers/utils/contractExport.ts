// app/(supplyChain)/(pages)/suppliers/utils/contractExport.ts
/**
 * Contract & SOW Export Utility
 * Provides professional PDF and MS Word (.doc) document generation for the
 * 20 PMBOK / ISO 10845 procurement elements, complete with Airship Express branding,
 * supplier metadata, structured clause tables, and formal signature blocks.
 */

import { toast } from "sonner";
import {
    ContractTerms,
    ContractSignatories,
    CONTRACT_ELEMENTS,
    CONTRACT_CATEGORIES,
} from "./contractElements";

export interface ContractExportOptions {
    contractNumber: string;
    supplierName: string;
    supplierContact?: string;
    supplierPhone?: string;
    supplierEmail?: string;
    supplierAddress?: string;
    effectiveDate?: string;
    expirationDate?: string;
    terms: ContractTerms;
    signatories?: ContractSignatories;
}

/**
 * Loads image from public path and converts it into a base64 Data URL.
 */
async function loadBase64Logo(url: string = "/images/logo-remove-bg.png"): Promise<string | null> {
    if (typeof window === "undefined") return null;
    return new Promise((resolve) => {
        try {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                try {
                    const canvas = document.createElement("canvas");
                    canvas.width = img.naturalWidth || 651;
                    canvas.height = img.naturalHeight || 383;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) return resolve(null);
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL("image/png"));
                } catch {
                    resolve(null);
                }
            };
            img.onerror = () => resolve(null);
            img.src = url;
        } catch {
            resolve(null);
        }
    });
}

/**
 * Generates and downloads an official high-resolution PDF procurement contract.
 */
export async function exportContractPdf(options: ContractExportOptions): Promise<void> {
    const toastId = toast.loading("Generating official Contract & SOW PDF...");

    try {
        const { default: jsPDF } = await import("jspdf");
        const autotableModule = await import("jspdf-autotable");
        const autoTable =
            autotableModule.autoTable ||
            (autotableModule.default as any)?.autoTable ||
            autotableModule.default;

        const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 36;
        let cursorY = 32;

        // 1. Header with Logo
        const logoBase64 = await loadBase64Logo();
        let brandStartX = margin;
        if (logoBase64) {
            try {
                const logoH = 28;
                const logoW = Math.round(logoH * (651 / 383));
                doc.addImage(logoBase64, "PNG", margin, cursorY + 2, logoW, logoH);
                brandStartX = margin + logoW + 10;
            } catch (e) {
                console.warn("Could not render logo in PDF:", e);
            }
        }

        // Brand Name
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.setTextColor(15, 23, 42); // Slate 900
        doc.text("Airship", brandStartX, cursorY + 14);

        const airshipWidth = doc.getTextWidth("Airship");
        doc.setTextColor(219, 39, 119); // Pink 600
        doc.text("Express", brandStartX + airshipWidth + 2, cursorY + 14);

        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139); // Slate 500
        doc.text("SUPPLY CHAIN & PROCUREMENT LOGISTICS DIVISION", brandStartX, cursorY + 26);

        // Document Reference & Badge (Right Aligned)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text("MASTER PROCUREMENT CONTRACT", pageWidth - margin, cursorY + 12, { align: "right" });

        doc.setFontSize(10);
        doc.setTextColor(219, 39, 119);
        doc.text(options.contractNumber || "AGR-2026-0001", pageWidth - margin, cursorY + 24, { align: "right" });

        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        const effDate = options.effectiveDate || new Date().toISOString().split("T")[0];
        const expDate = options.expirationDate || "Open / 1-Year Standard";
        doc.text(`Effective: ${effDate} · Valid Until: ${expDate}`, pageWidth - margin, cursorY + 35, { align: "right" });

        cursorY += 46;

        // Separator
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(1);
        doc.line(margin, cursorY, pageWidth - margin, cursorY);
        cursorY += 12;

        // Subtitle / Legal Preamble
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text("STATEMENT OF WORK & PROCUREMENT DELIVERABLES SPECIFICATION", margin, cursorY);
        cursorY += 12;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        const preambleText = `This Master Procurement Agreement & Statement of Work is executed between Airship Express Logistics Corp. ("Buyer") and ${options.supplierName} ("Seller"). The parties agree to the 20 statutory procurement specifications, operational baselines, commercial terms, and governance standards set forth below pursuant to PMBOK and ISO 10845 procurement guidelines.`;
        const preambleLines = doc.splitTextToSize(preambleText, pageWidth - margin * 2);
        doc.text(preambleLines, margin, cursorY);
        cursorY += preambleLines.length * 9.5 + 8;

        // 2. Buyer & Seller Parties Info Cards (Side by Side)
        const colW = (pageWidth - margin * 2 - 14) / 2;
        const cardH = 64;

        // Buyer Card
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(margin, cursorY, colW, cardH, 4, 4, "FD");

        let bY = cursorY + 12;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(219, 39, 119);
        doc.text("BUYER (CONSIGNEE & REQUISITIONER)", margin + 10, bY);
        bY += 11;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text("Airship Express Logistics Corp.", margin + 10, bY);
        bY += 10;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        doc.text("Central Operations & Sorting Hub, Metro Manila, PH", margin + 10, bY);
        bY += 9;
        doc.text("Authorized Officer: Procurement Division", margin + 10, bY);

        // Seller Card
        const sellerX = margin + colW + 14;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(sellerX, cursorY, colW, cardH, 4, 4, "FD");

        let sY = cursorY + 12;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(219, 39, 119);
        doc.text("SELLER (ACCREDITED SUPPLIER)", sellerX + 10, sY);
        sY += 11;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text(options.supplierName.slice(0, 36), sellerX + 10, sY);
        sY += 10;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        const contactLine = `Rep: ${options.supplierContact || "Authorized Representative"} · ${options.supplierPhone || options.supplierEmail || "Contact on File"}`;
        doc.text(contactLine.slice(0, 42), sellerX + 10, sY);
        sY += 9;
        const locLine = options.supplierAddress || "Registered Commercial Facility";
        doc.text(locLine.slice(0, 42), sellerX + 10, sY);

        cursorY += cardH + 12;

        // 3. The 20 Elements Table
        const tableBody = CONTRACT_ELEMENTS.map((el) => {
            const rawContent = options.terms[el.key] || "";
            return [
                String(el.number),
                `${el.label}\n[${el.category.toUpperCase()}]`,
                rawContent.trim() || "Not specified / Standard commercial terms apply.",
            ];
        });

        autoTable(doc, {
            startY: cursorY,
            margin: { left: margin, right: margin, bottom: 48 },
            head: [["#", "Procurement Element & Category", "Contractual Stipulations & Specifications"]],
            body: tableBody,
            theme: "grid",
            headStyles: {
                fillColor: [219, 39, 119], // Pink 600
                textColor: [255, 255, 255],
                fontSize: 8,
                fontStyle: "bold",
                halign: "left",
                cellPadding: 5,
            },
            columnStyles: {
                0: { cellWidth: 24, halign: "center", fontStyle: "bold", textColor: [100, 116, 139] },
                1: { cellWidth: 140, fontStyle: "bold", textColor: [15, 23, 42], fontSize: 7.5 },
                2: { fontSize: 7.5, textColor: [51, 65, 85], cellPadding: 5 },
            },
            styles: {
                overflow: "linebreak",
                cellPadding: 4,
                lineColor: [226, 232, 240],
                lineWidth: 0.5,
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252],
            },
            didDrawPage: (data: any) => {
                // Header on subsequent pages
                if (data.pageNumber > 1) {
                    doc.setFontSize(7.5);
                    doc.setFont("helvetica", "normal");
                    doc.setTextColor(148, 163, 184);
                    doc.text(
                        `${options.contractNumber} · ${options.supplierName} · Master Procurement Agreement`,
                        margin,
                        22
                    );
                }

                // Footer with page numbering
                const str = `Page ${data.pageNumber} · Airship Express Supply Chain Management · PMBOK / ISO 10845 Compliant`;
                doc.setFontSize(7);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(148, 163, 184);
                doc.text(str, pageWidth / 2, pageHeight - 18, { align: "center" });
            },
        });

        // 4. Signatures Block
        let finalY = (doc as any).lastAutoTable?.finalY || cursorY;

        // If not enough room for signatures (needs ~90pt), add new page
        if (finalY + 110 > pageHeight - 40) {
            doc.addPage();
            finalY = 40;
        } else {
            finalY += 18;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text("EXECUTION & SIGNATORIES", margin, finalY);
        finalY += 12;

        const sigBoxW = (pageWidth - margin * 2 - 20) / 2;
        const sigH = 65;

        // Buyer Signature Box
        doc.setDrawColor(203, 213, 225);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(margin, finalY, sigBoxW, sigH, 3, 3, "D");

        let bSigY = finalY + 12;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text("FOR BUYER: AIRSHIP EXPRESS LOGISTICS", margin + 10, bSigY);
        bSigY += 26;
        doc.line(margin + 10, bSigY, margin + sigBoxW - 10, bSigY);
        bSigY += 10;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        const buyerSigner = options.signatories?.buyer?.name || "Airship Express Procurement Officer";
        doc.text(buyerSigner, margin + 10, bSigY);
        bSigY += 9;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(options.signatories?.buyer?.title || "Head of Procurement & Supply Chain", margin + 10, bSigY);

        // Seller Signature Box
        const sSigX = margin + sigBoxW + 20;
        doc.roundedRect(sSigX, finalY, sigBoxW, sigH, 3, 3, "D");

        let sSigY = finalY + 12;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`FOR SELLER: ${options.supplierName.slice(0, 30).toUpperCase()}`, sSigX + 10, sSigY);
        sSigY += 26;
        doc.line(sSigX + 10, sSigY, sSigX + sigBoxW - 10, sSigY);
        sSigY += 10;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        const sellerSigner = options.signatories?.seller?.name || options.supplierContact || "Authorized Representative";
        doc.text(sellerSigner, sSigX + 10, sSigY);
        sSigY += 9;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(options.signatories?.seller?.title || "Authorized Representative", sSigX + 10, sSigY);

        // Download trigger
        const safeName = options.supplierName.replace(/[^a-zA-Z0-9_-]/g, "_");
        const fileName = `${options.contractNumber}_${safeName}_Contract_SOW.pdf`;
        doc.save(fileName);

        toast.success("PDF contract downloaded successfully!", { id: toastId });
    } catch (err: any) {
        console.error("Error exporting PDF contract:", err);
        toast.error("Failed to generate PDF contract: " + (err?.message || "Unknown error"), { id: toastId });
    }
}

/**
 * Generates and downloads a formatted Microsoft Word (.doc) document
 * containing the 20 procurement elements, brand letterhead, and signature blocks.
 */
export async function exportContractWord(options: ContractExportOptions): Promise<void> {
    const toastId = toast.loading("Generating Microsoft Word contract (.doc)...");

    try {
        const effDate = options.effectiveDate || new Date().toISOString().split("T")[0];
        const expDate = options.expirationDate || "Open / 1-Year Standard";
        const buyerSigner = options.signatories?.buyer?.name || "Airship Express Procurement Officer";
        const buyerTitle = options.signatories?.buyer?.title || "Head of Procurement";
        const sellerSigner = options.signatories?.seller?.name || options.supplierContact || "Authorized Representative";
        const sellerTitle = options.signatories?.seller?.title || "Authorized Representative";

        // Build HTML Table Rows
        const rowsHtml = CONTRACT_ELEMENTS.map((el) => {
            const val = (options.terms[el.key] || "").trim() || "Not specified.";
            const formattedVal = val.replace(/\n/g, "<br/>");
            return `
            <tr>
                <td style="width: 35px; text-align: center; font-weight: bold; color: #64748b; vertical-align: top; padding: 8px; border: 1px solid #cbd5e1;">
                    ${el.number}
                </td>
                <td style="width: 170px; vertical-align: top; padding: 8px; border: 1px solid #cbd5e1;">
                    <strong style="color: #0f172a; font-size: 10pt;">${el.label}</strong>
                    <div style="color: #db2777; font-size: 8pt; font-weight: bold; margin-top: 3px;">[${el.category.toUpperCase()}]</div>
                    <div style="color: #64748b; font-size: 8pt; margin-top: 2px;">${el.description}</div>
                </td>
                <td style="vertical-align: top; padding: 8px; border: 1px solid #cbd5e1; color: #334155; font-size: 9.5pt; line-height: 1.45;">
                    ${formattedVal}
                </td>
            </tr>
            `;
        }).join("");

        // Build Word-compatible HTML document
        const wordHtml = `
<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
    <meta charset="utf-8">
    <title>${options.contractNumber} - ${options.supplierName} Master Procurement Agreement</title>
    <!--[if gte mso 9]>
    <xml>
        <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
    </xml>
    <![endif]-->
    <style>
        @page Section1 {
            size: 8.5in 11.0in;
            margin: 0.75in 0.75in 0.75in 0.75in;
            mso-header-margin: 0.5in;
            mso-footer-margin: 0.5in;
            mso-paper-source: 0;
        }
        div.Section1 { page: Section1; }
        body {
            font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
            font-size: 10.5pt;
            color: #0f172a;
            line-height: 1.4;
        }
        h1 {
            color: #0f172a;
            font-size: 18pt;
            margin: 0;
            padding: 0;
        }
        h2 {
            color: #db2777;
            font-size: 13pt;
            margin-top: 6px;
            margin-bottom: 12px;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin-top: 14px;
            margin-bottom: 18px;
        }
        th {
            background-color: #db2777;
            color: #ffffff;
            font-size: 10pt;
            font-weight: bold;
            text-align: left;
            padding: 8px;
            border: 1px solid #be185d;
        }
        .meta-table td {
            padding: 6px 10px;
            border: 1px solid #e2e8f0;
            background-color: #f8fafc;
            font-size: 9pt;
        }
        .meta-label {
            color: #64748b;
            font-weight: bold;
            width: 20%;
        }
        .sig-block {
            width: 48%;
            border: 1px solid #cbd5e1;
            padding: 14px;
            background-color: #ffffff;
        }
    </style>
</head>
<body>
    <div class="Section1">
        <!-- Letterhead Header -->
        <table style="width: 100%; border: none; margin-bottom: 16px;">
            <tr>
                <td style="border: none; vertical-align: top;">
                    <h1>Airship <span style="color: #db2777;">Express</span></h1>
                    <div style="color: #64748b; font-size: 8.5pt; font-weight: bold; letter-spacing: 0.5px;">
                        SUPPLY CHAIN & PROCUREMENT LOGISTICS DIVISION
                    </div>
                </td>
                <td style="border: none; text-align: right; vertical-align: top;">
                    <div style="font-size: 12pt; font-weight: bold; color: #0f172a;">MASTER PROCUREMENT CONTRACT</div>
                    <div style="font-size: 11pt; font-weight: bold; color: #db2777;">#${options.contractNumber}</div>
                    <div style="font-size: 8pt; color: #64748b; margin-top: 3px;">
                        Effective: ${effDate} · Valid: ${expDate}
                    </div>
                </td>
            </tr>
        </table>

        <hr style="border: 0; border-top: 2px solid #db2777; margin-bottom: 14px;" />

        <h2>Statement of Work (SOW) & Procurement Specifications</h2>
        <p style="font-size: 9.5pt; color: #475569; line-height: 1.5; margin-bottom: 14px;">
            This Master Procurement Agreement & Statement of Work is executed between <strong>Airship Express Logistics Corp.</strong> ("Buyer") and <strong>${options.supplierName}</strong> ("Seller"). The parties agree to the following 20 procurement specifications, commercial baselines, and legal governance clauses structured in accordance with PMBOK and ISO 10845 procurement standards.
        </p>

        <!-- Parties Metadata Summary Table -->
        <table class="meta-table">
            <tr>
                <td class="meta-label">BUYER:</td>
                <td><strong>Airship Express Logistics Corp.</strong> (Procurement Operations Hub)</td>
                <td class="meta-label">SELLER:</td>
                <td><strong>${options.supplierName}</strong></td>
            </tr>
            <tr>
                <td class="meta-label">BUYER FACILITY:</td>
                <td>Central Sorting & Distribution Center, Metro Manila</td>
                <td class="meta-label">SELLER CONTACT:</td>
                <td>${options.supplierContact || "Authorized Rep"} (${options.supplierPhone || options.supplierEmail || "On file"})</td>
            </tr>
            <tr>
                <td class="meta-label">CONTRACT REF:</td>
                <td><strong>${options.contractNumber}</strong></td>
                <td class="meta-label">SELLER FACILITY:</td>
                <td>${options.supplierAddress || "Registered Commercial Facility"}</td>
            </tr>
        </table>

        <!-- 20 Elements Table -->
        <table>
            <thead>
                <tr>
                    <th style="width: 35px; text-align: center;">#</th>
                    <th style="width: 170px;">Procurement Element & Category</th>
                    <th>Contractual Stipulations & Specifications</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
            </tbody>
        </table>

        <!-- Signatures Block -->
        <h3 style="color: #0f172a; font-size: 11pt; margin-top: 20px; margin-bottom: 10px;">Execution & Signatures</h3>
        <table style="width: 100%; border: none;">
            <tr>
                <td class="sig-block" style="vertical-align: top;">
                    <div style="font-weight: bold; color: #db2777; font-size: 8.5pt;">FOR BUYER: AIRSHIP EXPRESS LOGISTICS</div>
                    <div style="margin-top: 40px; border-bottom: 1px solid #0f172a; width: 85%;"></div>
                    <div style="font-weight: bold; font-size: 9.5pt; margin-top: 6px; color: #0f172a;">${buyerSigner}</div>
                    <div style="font-size: 8.5pt; color: #64748b;">${buyerTitle}</div>
                    <div style="font-size: 8pt; color: #94a3b8; margin-top: 4px;">Date: ________________________</div>
                </td>
                <td style="width: 4%; border: none;"></td>
                <td class="sig-block" style="vertical-align: top;">
                    <div style="font-weight: bold; color: #db2777; font-size: 8.5pt;">FOR SELLER: ${options.supplierName.toUpperCase()}</div>
                    <div style="margin-top: 40px; border-bottom: 1px solid #0f172a; width: 85%;"></div>
                    <div style="font-weight: bold; font-size: 9.5pt; margin-top: 6px; color: #0f172a;">${sellerSigner}</div>
                    <div style="font-size: 8.5pt; color: #64748b;">${sellerTitle}</div>
                    <div style="font-size: 8pt; color: #94a3b8; margin-top: 4px;">Date: ________________________</div>
                </td>
            </tr>
        </table>

        <div style="margin-top: 25px; text-align: center; font-size: 8pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px;">
            Confidential Procurement Document · Airship Express Logistics Corp. · ISO 10845 / PMBOK Standard
        </div>
    </div>
</body>
</html>
        `;

        const blob = new Blob(["\ufeff", wordHtml], {
            type: "application/msword;charset=utf-8",
        });

        const safeName = options.supplierName.replace(/[^a-zA-Z0-9_-]/g, "_");
        const fileName = `${options.contractNumber}_${safeName}_Contract_SOW.doc`;

        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        toast.success("Microsoft Word contract (.doc) downloaded successfully!", { id: toastId });
    } catch (err: any) {
        console.error("Error exporting Word contract:", err);
        toast.error("Failed to generate Word contract: " + (err?.message || "Unknown error"), { id: toastId });
    }
}

