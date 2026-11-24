// Pure, client-side formatting helpers for fleet data returned by the
// backend. This file does not fetch anything itself - chatbotService.ts
// owns all network calls - it only shapes data for display.

export function statusTone(status?: string | null): "positive" | "warning" | "negative" | "neutral" {
  const s = (status || "").toLowerCase();
  if (/available|active|on time|completed|success/.test(s)) return "positive";
  if (/maintenance|delay|pending|scheduled/.test(s)) return "warning";
  if (/cancel|error|out of service|late/.test(s)) return "negative";
  return "neutral";
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCurrency(value?: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(value);
}

export function formatNumber(value?: number | null, suffix = ""): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${new Intl.NumberFormat().format(value)}${suffix}`;
}
