import { InventoryItem } from '../types';

export interface ItemCandidateMatch {
    item: InventoryItem;
    score: number;
    matchReasons: string[];
    isExact: boolean;
}

export interface ItemMatchEvaluation {
    requestedName: string;
    requestedQty: number;
    matchType: 'exact' | 'partial' | 'none';
    matchedItem: InventoryItem | null;
    candidates: ItemCandidateMatch[];
    hasCandidates: boolean;
    currentStock: number;
    minimumStock: number;
    isStockSufficient: boolean;
    isLowStock: boolean;
    isOutOfStock: boolean;
    status: 'Available' | 'Low Stock' | 'Out of Stock' | 'Possible Match' | 'New Item';
}

/**
 * Basic word stemmer/normalizer for plurals and common suffixes
 */
function normalizeWord(w: string): string {
    let word = w.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    if (word.endsWith('ies') && word.length > 4) {
        word = word.slice(0, -3) + 'y';
    } else if (word.endsWith('es') && word.length > 3) {
        word = word.slice(0, -2);
    } else if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) {
        word = word.slice(0, -1);
    }
    return word;
}

/**
 * Tokenize string into normalized words
 */
function tokenize(text: string): string[] {
    const stopwords = new Set(['the', 'a', 'an', 'of', 'for', 'in', 'on', 'and', 'to', 'with', 'by']);
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .map(normalizeWord)
        .filter(w => w.length > 1 && !stopwords.has(w));
}

/**
 * Evaluates a requested item against the live inventory catalog.
 * Detects exact matches as well as possible similar candidates.
 */
export function evaluateItemMatch(
    requestedItemName: string,
    requestedQty: number = 1,
    catalog: InventoryItem[],
    explicitCodeOrId?: string
): ItemMatchEvaluation {
    const nameClean = (requestedItemName || '').trim();
    const nameLower = nameClean.toLowerCase();
    const queryTokens = tokenize(nameClean);

    if (!nameClean || !catalog || catalog.length === 0) {
        return {
            requestedName: requestedItemName,
            requestedQty,
            matchType: 'none',
            matchedItem: null,
            candidates: [],
            hasCandidates: false,
            currentStock: 0,
            minimumStock: 0,
            isStockSufficient: false,
            isLowStock: false,
            isOutOfStock: true,
            status: 'New Item',
        };
    }

    // 1. Check for Exact Match
    let exactMatch: InventoryItem | null = null;

    if (explicitCodeOrId) {
        exactMatch = catalog.find(
            i => i.id === explicitCodeOrId || i.item_code?.toLowerCase() === explicitCodeOrId.toLowerCase()
        ) || null;
    }

    if (!exactMatch) {
        // Section 3: If multiple inventory records represent the same actual item, prioritize:
        // 1. Records with an official supplier assigned (official_supplier_id)
        // 2. Records with positive usable stock (current_stock > 0)
        // 3. Highest ID / most recent
        const exactMatches = catalog.filter(
            i => i.item_name.toLowerCase().trim() === nameLower ||
                 (i.item_code && i.item_code.toLowerCase() === nameLower)
        );

        if (exactMatches.length > 0) {
            exactMatches.sort((a, b) => {
                const aHasOfficial = Boolean((a as any).official_supplier_id);
                const bHasOfficial = Boolean((b as any).official_supplier_id);
                if (aHasOfficial && !bHasOfficial) return -1;
                if (bHasOfficial && !aHasOfficial) return 1;

                const aStock = Number(a.current_stock || 0);
                const bStock = Number(b.current_stock || 0);
                if (aStock > 0 && bStock === 0) return -1;
                if (bStock > 0 && aStock === 0) return 1;

                return Number(b.id || 0) - Number(a.id || 0);
            });
            exactMatch = exactMatches[0];
        }
    }

    if (exactMatch) {
        const currentStock = Number(exactMatch.current_stock || 0);
        const minimumStock = Number(exactMatch.minimum_stock || 0);
        const isSufficient = currentStock >= requestedQty;
        const isLow = currentStock > 0 && currentStock <= minimumStock;
        const isOut = currentStock <= 0;

        const status = isOut ? 'Out of Stock' : (isLow ? 'Low Stock' : 'Available');

        return {
            requestedName: requestedItemName,
            requestedQty,
            matchType: 'exact',
            matchedItem: exactMatch,
            candidates: [{
                item: exactMatch,
                score: 100,
                matchReasons: ['Exact item name match in warehouse catalog'],
                isExact: true,
            }],
            hasCandidates: true,
            currentStock,
            minimumStock,
            isStockSufficient: isSufficient,
            isLowStock: isLow,
            isOutOfStock: isOut,
            status,
        };
    }

    // 2. Score Candidates for Similar/Possible Matches
    const scoredCandidates: ItemCandidateMatch[] = [];

    for (const item of catalog) {
        const itemLower = item.item_name.toLowerCase().trim();
        const itemTokens = tokenize(itemLower);
        const itemCodeLower = (item.item_code || '').toLowerCase();
        let score = 0;
        const reasons: string[] = [];

        // Direct Substring Match (e.g. "tape" inside "Packaging Tape Clear" or "white tape" containing "tape")
        if (itemLower.includes(nameLower) || nameLower.includes(itemLower)) {
            score += 55;
            reasons.push('Name contains full search phrase');
        }

        // Code matching
        if (itemCodeLower && (nameLower.includes(itemCodeLower) || itemCodeLower.includes(nameLower))) {
            score += 40;
            reasons.push(`Matches item code prefix [${item.item_code}]`);
        }

        // Token Overlap (e.g. "tape" or "white")
        let matchingTokensCount = 0;
        for (const qToken of queryTokens) {
            for (const iToken of itemTokens) {
                if (qToken === iToken) {
                    matchingTokensCount++;
                    score += 30;
                    reasons.push(`Contains keyword "${qToken}"`);
                } else if (qToken.length > 3 && iToken.length > 3 && (qToken.includes(iToken) || iToken.includes(qToken))) {
                    matchingTokensCount++;
                    score += 15;
                    reasons.push(`Similar keyword "${qToken}" ~ "${iToken}"`);
                }
            }
        }

        // Category relevance bonus if category matches any token
        const catLower = (item.category || '').toLowerCase();
        for (const qToken of queryTokens) {
            if (catLower.includes(qToken)) {
                score += 10;
                reasons.push(`Matches category [${item.category}]`);
                break;
            }
        }

        if (score >= 20) {
            scoredCandidates.push({
                item,
                score,
                matchReasons: Array.from(new Set(reasons)),
                isExact: false,
            });
        }
    }

    // Sort candidates by score descending, then by stock descending
    scoredCandidates.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return Number(b.item.current_stock || 0) - Number(a.item.current_stock || 0);
    });

    const topCandidates = scoredCandidates.slice(0, 4);

    if (topCandidates.length > 0) {
        const top = topCandidates[0].item;
        const currentStock = Number(top.current_stock || 0);
        const minimumStock = Number(top.minimum_stock || 0);
        const isSufficient = currentStock >= requestedQty;
        const isLow = currentStock > 0 && currentStock <= minimumStock;
        const isOut = currentStock <= 0;

        return {
            requestedName: requestedItemName,
            requestedQty,
            matchType: 'partial',
            matchedItem: top,
            candidates: topCandidates,
            hasCandidates: true,
            currentStock,
            minimumStock,
            isStockSufficient: isSufficient,
            isLowStock: isLow,
            isOutOfStock: isOut,
            status: 'Possible Match',
        };
    }

    // 3. No match found -> Brand New Item
    return {
        requestedName: requestedItemName,
        requestedQty,
        matchType: 'none',
        matchedItem: null,
        candidates: [],
        hasCandidates: false,
        currentStock: 0,
        minimumStock: 0,
        isStockSufficient: false,
        isLowStock: false,
        isOutOfStock: true,
        status: 'New Item',
    };
}
