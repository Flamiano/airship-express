/**
 * Display formatting for hybrid goal-progress measurement values.
 *
 * Client-safe display helpers only: they never calculate canonical progress
 * (the server owns `actual / target * 100`) and never influence scoring.
 * All functions tolerate null/undefined by rendering an em dash.
 */

import type { GoalMeasurementType } from "@/performance-development-dashboard/types";

export const MEASUREMENT_TYPE_LABELS: Record<GoalMeasurementType, string> = {
  number: "Number",
  currency: "Currency",
  percentage: "Percentage",
  custom: "Custom unit",
};

function compactNumber(value: number): string {
  const abs = Math.abs(value);
  const trim = (text: string): string =>
    text.includes(".") ? text.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1") : text;
  if (abs >= 1_000_000_000) return `${trim((value / 1_000_000_000).toFixed(1))}B`;
  if (abs >= 1_000_000) return `${trim((value / 1_000_000).toFixed(1))}M`;
  if (abs >= 1_000) return `${trim((value / 1_000).toFixed(1))}K`;
  return trim(String(Math.round(value * 100) / 100));
}

function fullNumber(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/**
 * Full `actual / target` rendering, e.g. `₱750,000 / ₱1,000,000`,
 * `15 / 20`, `90% / 95%`, `325 / 500 Orders`. Currency uses the ₱ sign with
 * the stored unit appended when one exists (e.g. `₱… PHP`); units are
 * display-only labels with no conversion semantics.
 */
export function formatMeasuredPair(
  actual: number | null,
  target: number | null,
  type: GoalMeasurementType | null,
  unit: string | null,
): string {
  const actualText = actual === null ? "—" : fullNumber(actual);
  const targetText = target === null ? "—" : fullNumber(target);
  if (type === "currency") {
    const suffix = unit ? ` ${unit}` : "";
    return `₱${actualText} / ₱${targetText}${suffix}`;
  }
  if (type === "percentage") {
    return `${actualText}% / ${targetText}%`;
  }
  const suffix = unit ? ` ${unit}` : "";
  return `${actualText} / ${targetText}${suffix}`;
}

/**
 * Compact one-line rendering for dense surfaces (goal cards), e.g.
 * `₱750K / ₱1M`, `15 / 20`, `90% / 95%`, `325 / 500 Orders`.
 */
export function formatMeasuredPairCompact(
  actual: number | null,
  target: number | null,
  type: GoalMeasurementType | null,
  unit: string | null,
): string {
  const actualText = actual === null ? "—" : compactNumber(actual);
  const targetText = target === null ? "—" : compactNumber(target);
  if (type === "currency") {
    const suffix = unit ? ` ${unit}` : "";
    return `₱${actualText} / ₱${targetText}${suffix}`;
  }
  if (type === "percentage") {
    return `${actualText}% / ${targetText}%`;
  }
  const suffix = unit ? ` ${unit}` : "";
  return `${actualText} / ${targetText}${suffix}`;
}

/**
 * Display-only achievement vs target (uncapped), e.g. 125 for 125%.
 * The canonical stored/displayed progress stays capped at 100.
 */
export function achievementPercent(
  actual: number | null,
  target: number | null,
): number | null {
  if (actual === null || target === null || !(target > 0)) return null;
  return Math.round((actual / target) * 100 * 100) / 100;
}
