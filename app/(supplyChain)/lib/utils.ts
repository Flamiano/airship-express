import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalizes item names for accurate matching across purchase requests, orders, and inventory:
 * - Case-insensitive
 * - Trims leading & trailing whitespace
 * - Collapses repeated whitespace/tabs into a single space
 * - Prevents overly broad matching (e.g. 'Laptop' does NOT match 'Laptop Stand')
 */
export function normalizeItemName(name?: string | null): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Irregular or unchanging nouns ending in 's' that should not be stripped.
 */
const IRREGULAR_UNCHANGING_NOUNS = new Set([
  "gas",
  "bus",
  "lens",
  "status",
  "chassis",
  "series",
  "species",
  "canvas",
  "plus",
  "bias",
  "apparatus",
  "axis",
]);

const IRREGULAR_PLURALS: Record<string, string> = {
  mice: "mouse",
  teeth: "tooth",
  feet: "foot",
};

/**
 * Converts simple plural forms to singular while preserving distinct product phrases.
 * E.g.:
 * - 'laptops' -> 'laptop'
 * - 'Lptops' -> 'lptop'
 * - 'batteries' -> 'battery'
 * - 'boxes' -> 'box'
 */
export function toSingularForm(phrase?: string | null): string {
  const normalized = normalizeItemName(phrase);
  if (!normalized) return "";

  const words = normalized.split(" ");
  const lastWord = words[words.length - 1];

  if (IRREGULAR_PLURALS[lastWord]) {
    words[words.length - 1] = IRREGULAR_PLURALS[lastWord];
    return words.join(" ");
  }

  if (IRREGULAR_UNCHANGING_NOUNS.has(lastWord)) {
    return normalized;
  }

  let singularLast = lastWord;

  if (lastWord.endsWith("ies") && lastWord.length > 4) {
    // e.g. batteries -> battery, supplies -> supply, accessories -> accessory
    singularLast = lastWord.slice(0, -3) + "y";
  } else if (
    (lastWord.endsWith("ses") && !lastWord.endsWith("sses")) ||
    lastWord.endsWith("xes") ||
    lastWord.endsWith("ches") ||
    lastWord.endsWith("shes") ||
    lastWord.endsWith("sses")
  ) {
    // e.g. boxes -> box, watches -> watch, brushes -> brush, glasses -> glass
    singularLast = lastWord.slice(0, -2);
  } else if (lastWord.endsWith("s") && !lastWord.endsWith("ss") && lastWord.length > 3) {
    // e.g. laptops -> laptop, monitors -> monitor, lptops -> lptop
    singularLast = lastWord.slice(0, -1);
  }

  words[words.length - 1] = singularLast;
  return words.join(" ");
}

/**
 * Computes standard Levenshtein edit distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) row[j] = j;

  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j];
      if (a[i - 1] === b[j - 1]) {
        row[j] = prev;
      } else {
        row[j] = Math.min(prev + 1, row[j] + 1, row[j - 1] + 1);
      }
      prev = temp;
    }
  }
  return row[b.length];
}

/**
 * Checks whether vowel sequence in shorter string is a subsequence of longer string.
 */
function isVowelSubsequence(shortStr: string, longStr: string): boolean {
  const vShort = shortStr.replace(/[^aeiou]/g, "");
  const vLong = longStr.replace(/[^aeiou]/g, "");
  if (vShort === vLong) return true;
  let idx = 0;
  for (const char of vLong) {
    if (char === vShort[idx]) idx++;
    if (idx === vShort.length) return true;
  }
  return false;
}

/**
 * Checks if two item names are related, supporting:
 * - Case variations (LAPTOP vs laptop)
 * - Singular / Plural variations (Laptop vs Laptops, Battery vs Batteries)
 * - Typo and vowel omission variations (Laptop vs Lptops, labtop, laptpo)
 * - Token & compound matching (Dell Laptop vs Laptop, Gaming Laptops vs Lptops)
 */
export function isItemRelated(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const normA = normalizeItemName(a);
  const normB = normalizeItemName(b);
  if (!normA || !normB) return false;
  if (normA === normB) return true;

  // 1. Singular match
  const singA = toSingularForm(normA);
  const singB = toSingularForm(normB);
  if (singA === singB) return true;

  // 2. Alphanumeric match (ignoring dashes, slashes, punctuation: "lap-top" vs "laptop")
  const cleanA = singA.replace(/[^a-z0-9]/g, "");
  const cleanB = singB.replace(/[^a-z0-9]/g, "");
  if (cleanA && cleanB && cleanA === cleanB) return true;

  // 3. Consonant skeleton contraction match (e.g. "lptops" -> "lptop" -> skeleton "lptp" vs "laptop" -> "lptp")
  const skelA = cleanA.replace(/[aeiou]/g, "");
  const skelB = cleanB.replace(/[aeiou]/g, "");
  if (skelA && skelB && skelA === skelB && skelA.length >= 3) {
    const [shorter, longer] = cleanA.length <= cleanB.length ? [cleanA, cleanB] : [cleanB, cleanA];
    if (longer.length - shorter.length <= 2 && isVowelSubsequence(shorter, longer)) {
      return true;
    }
  }

  // 4. Fuzzy edit distance on entire cleaned item name
  if (cleanA.length >= 5 && cleanB.length >= 5) {
    const dist = levenshteinDistance(cleanA, cleanB);
    const maxLen = Math.max(cleanA.length, cleanB.length);
    // For 5-letter words, allow distance 1 only if length differs (vowel drop/add)
    if (maxLen === 5 && dist <= 1 && cleanA.length !== cleanB.length) return true;
    // For 6+ letter words, distance <= 2 is a match (e.g. labtop vs laptop, moniter vs monitor)
    if (maxLen >= 6 && dist <= 2) return true;
    if (dist / maxLen <= 0.25) return true;
  }

  // 5. Token-level matching for multi-word or compound descriptions
  const tokensA = normA.split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
  const tokensB = normB.split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
  for (const tA of tokensA) {
    for (const tB of tokensB) {
      if (tA === tB) return true;
      const sTA = toSingularForm(tA);
      const sTB = toSingularForm(tB);
      if (sTA === sTB) return true;
      const skTA = sTA.replace(/[aeiou]/g, "");
      const skTB = sTB.replace(/[aeiou]/g, "");
      if (skTA && skTB && skTA === skTB && skTA.length >= 3) {
        const [shorter, longer] = sTA.length <= sTB.length ? [sTA, sTB] : [sTB, sTA];
        if (longer.length - shorter.length <= 2 && isVowelSubsequence(shorter, longer)) return true;
      }
      if (sTA.length >= 6 && sTB.length >= 6 && levenshteinDistance(sTA, sTB) <= 2) return true;
    }
  }

  return false;
}

export type POStatusIndicator = 'Pending Purchase Order' | 'Waiting for Delivery' | 'Rejected Purchase Order' | 'Delivered' | 'Approval Pending';

/**
 * Derives the purchase order status indicator from actual database columns.
 */
export function getPOStatusIndicator(po: {
  status?: string | null;
  admin_approval?: string | null;
  financial_approval?: string | null;
  fully_received?: boolean | null;
}): POStatusIndicator {
  const adminApp = String(po.admin_approval || "").trim().toLowerCase();
  const st = String(po.status || "").trim().toLowerCase();

  if (st === "delivered" || st === "completed" || po.fully_received === true) {
    return "Delivered";
  }

  if (adminApp === "rejected" || st === "rejected") {
    return "Rejected Purchase Order";
  }

  if (st === "issued") {
    return "Waiting for Delivery";
  }

  if (st === "pending" || adminApp === "pending") {
    return "Approval Pending";
  }

  return "Approval Pending";
}

/**
 * Finds the best matching Purchase Order for a given request or shortage item,
 * using normalized item-name matching and request ID comparison.
 * Prioritizes:
 * 1. Exact Request ID / UUID matches
 * 2. Exact Requisition number matches in PO notes
 * 3. Normalized item-name matching fallback
 * Within each specificity tier, active/pending/issued orders are prioritized over rejected orders.
 */
export function findBestMatchingPO(
  target: { id?: string | number | null; item_name?: string | null; request_id?: string | null; source_request?: string | null },
  purchaseOrders: any[]
): any | null {
  if (!Array.isArray(purchaseOrders) || purchaseOrders.length === 0) return null;

  const targetIdStr = target.id ? String(target.id).trim().toLowerCase() : "";
  const targetReqIdStr = target.request_id ? String(target.request_id).trim().toLowerCase() : "";
  const targetSourceStr = target.source_request ? String(target.source_request).replace(/^#/, "").trim().toLowerCase() : "";
  const targetItemNormalized = normalizeItemName(target.item_name);

  const matched = purchaseOrders.filter((po) => {
    if (!po) return false;
    const poStatus = String(po.status || "").trim().toLowerCase();
    if (poStatus === "cancelled") return false;

    // 1. Direct request ID match
    const poReqId = po.request_id ? String(po.request_id).trim().toLowerCase() : "";
    if (targetIdStr && poReqId === targetIdStr) return true;
    if (targetReqIdStr && poReqId === targetReqIdStr) return true;

    // 2. Check notes for source request number (e.g. #PR-1234 or Requisition #1234)
    if (targetSourceStr && po.notes) {
      const notesLower = String(po.notes).toLowerCase();
      if (notesLower.includes(targetSourceStr)) return true;
    }

    // 3. Item name matching (exact and related/fuzzy)
    if (targetItemNormalized) {
      if (Array.isArray(po.items) && po.items.some((it: any) => {
        const itName = it?.item_name || it?.name || "";
        return isItemRelated(targetItemNormalized, itName);
      })) {
        return true;
      }
      if (po.item_name && isItemRelated(targetItemNormalized, po.item_name)) {
        return true;
      }
    }

    return false;
  });

  if (matched.length === 0) return null;

  const getMatchSpecificity = (po: any): number => {
    const poReqId = po.request_id ? String(po.request_id).trim().toLowerCase() : "";
    if ((targetIdStr && poReqId === targetIdStr) || (targetReqIdStr && poReqId === targetReqIdStr)) {
      return 3; // Direct UUID/ID match
    }
    if (targetSourceStr && po.notes) {
      const notesLower = String(po.notes).toLowerCase();
      if (notesLower.includes(targetSourceStr)) {
        return 2; // Direct Requisition Number in notes
      }
    }
    return 1; // Generic item name match
  };

  const getRank = (po: any): number => {
    const st = String(po.status || "").toLowerCase().trim();
    const app = String(po.admin_approval || "").toLowerCase().trim();
    if (st === "rejected" || app === "rejected") return 1;
    if (st === "delivered" || st === "completed" || po.fully_received === true) return 2;
    if (st === "issued" || st === "sent" || st === "confirmed") return 4;
    return 3; // Pending, Draft, etc.
  };

  matched.sort((a, b) => {
    const specA = getMatchSpecificity(a);
    const specB = getMatchSpecificity(b);
    if (specA !== specB) return specB - specA;

    const rankA = getRank(a);
    const rankB = getRank(b);
    if (rankA !== rankB) return rankB - rankA;

    const timeA = new Date(a.created_at || a.updated_at || 0).getTime();
    const timeB = new Date(b.created_at || b.updated_at || 0).getTime();
    return timeB - timeA;
  });

  return matched[0];
}

