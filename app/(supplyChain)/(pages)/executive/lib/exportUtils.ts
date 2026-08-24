import { toast } from "sonner";

/**
 * Sanitizes CSV cell string values to prevent formula injection (DDE attacks)
 * and correctly handles double quotes.
 */
export function sanitizeCSVCell(cell: any): string {
    if (cell === null || cell === undefined) return '""';
    let str = String(cell).trim();
    if (/^[=+\-@\t\r]/.test(str)) {
        str = "'" + str;
    }
    return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Generates and downloads a structured executive report CSV file.
 */
export function downloadCSV(
    reportTitle: string,
    insightsSummary: { label: string; value: string | number; note?: string }[],
    strategicTakeaways: string[],
    headers: string[],
    rows: (string | number)[][]
) {
    try {
        const dateStr = new Date().toISOString().split('T')[0];
        const timestamp = new Date().toLocaleString();

        const lines: string[] = [
            `"================================================================================"`,
            `"AIRSHIP EXPRESS - EXECUTIVE INTELLIGENCE REPORT"`,
            `"Report Title: ${reportTitle.replace(/"/g, '""')}"`,
            `"Generated At: ${timestamp}"`,
            `"Environment: Production Supply Chain Analytics"`,
            `"================================================================================"`,
            ``,
            `"--- SECTION 1: EXECUTIVE KPI SUMMARY & METRIC INTELLIGENCE ---"`,
            `"Metric","Value","Strategic Note"`,
            ...insightsSummary.map(m => `${sanitizeCSVCell(m.label)},${sanitizeCSVCell(m.value)},${sanitizeCSVCell(m.note || '')}`),
            ``,
            `"--- SECTION 2: AI-ASSISTED OPERATIONAL INSIGHTS & TAKEAWAYS ---"`,
            ...strategicTakeaways.map((t, idx) => `"Key Finding ${idx + 1}:",${sanitizeCSVCell(t)}`),
            ``,
            `"--- SECTION 3: COMPLETE RECORD MANIFESTS & BREAKDOWN (${rows.length} Total Records) ---"`,
            headers.map(h => sanitizeCSVCell(h)).join(","),
            ...rows.map(e => e.map(val => sanitizeCSVCell(val)).join(",")),
            ``,
            `"================================================================================"`,
            `"CONFIDENTIAL - FOR INTERNAL MANAGEMENT USE ONLY"`
        ];

        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + lines.join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${reportTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_all_${rows.length}_records_${dateStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Exported complete dataset (${rows.length} records) with executive insights!`);
    } catch (error) {
        console.error("Error generating CSV:", error);
        toast.error("Failed to generate CSV download");
    }
}
