
import fs from 'fs';
import path from 'path';

export interface KnowledgeFile {
    name: string;
    content: string;
    path: string;
    category: string;
}

let knowledgeCache: Map<string, KnowledgeFile> | null = null;

/**
 * Load all knowledge files
 */
export function loadAllKnowledge(): Map<string, KnowledgeFile> {
    if (knowledgeCache) {
        return knowledgeCache;
    }

    knowledgeCache = new Map();

    try {
        const knowledgeDir = path.join(process.cwd(), 'app/(supplyChain)/ai/knowledge');

        if (fs.existsSync(knowledgeDir)) {
            const files = fs.readdirSync(knowledgeDir);

            for (const file of files) {
                if (file.endsWith('.md')) {
                    const filePath = path.join(knowledgeDir, file);
                    const content = fs.readFileSync(filePath, 'utf-8');
                    const name = file.replace('.md', '');

                    knowledgeCache.set(name, {
                        name,
                        content,
                        path: filePath,
                        category: 'general',
                    });

                }
            }
        } else {
            loadFallbackKnowledge();
        }
    } catch (error) {
        loadFallbackKnowledge();
    }

    if (knowledgeCache.size === 0) {
        loadFallbackKnowledge();
    }

    return knowledgeCache;
}

/**
 * Fallback knowledge
 */
function loadFallbackKnowledge(): void {

    if (!knowledgeCache) {
        knowledgeCache = new Map();
    }

    const fallback = {
        'warehousing': `
# Warehouse Operations

## Inbound Receiving
- Scan barcodes or enter manually
- System checks for duplicates
- Parcels enter receiving queue
- Status: Pending → Verified → Rejected

## Courier Sorting
- Sort parcels by destination
- Assign to couriers
- Group by region

## Outgoing Dispatch
- Scan to mark parcels as ready
- Batch dispatch to couriers
- Driver assignment

## Status Flow
Received → Sorting → Ready for Pickup → Picked Up → In Transit → Delivered
        `,
        'inventory': `
# Inventory Management

## Stock Status
- Available: Stock level is above minimum
- Low-Stock: At or below minimum threshold
- Out-of-Stock: No stock available

## Stock Operations
- Add stock with supplier reference
- Remove stock with department and purpose
- Auto-calculates new totals and status
        `,
        'operations': `
# Daily Operations

## Key Metrics
- Peak Hours: 10 AM - 12 PM
- Sorting Areas: 4/4 active
- Average Dwell Time: 3h 12m
- Scans per day: ~2,146

## Processes
1. Receive parcels from suppliers
2. Scan and verify
3. Sort by destination
4. Assign to couriers
5. Dispatch for delivery
        `
    };

    for (const [name, content] of Object.entries(fallback)) {
        knowledgeCache.set(name, {
            name,
            content,
            path: 'fallback',
            category: 'general',
        });
    }
}

/**
 * Get knowledge by name
 */
export function getKnowledge(name: string): KnowledgeFile | null {
    const knowledge = loadAllKnowledge();
    return knowledge.get(name) || null;
}

/**
 * Search knowledge
 */
export function searchKnowledge(query: string): KnowledgeFile[] {
    const knowledge = loadAllKnowledge();
    const results: KnowledgeFile[] = [];
    const lowerQuery = query.toLowerCase();

    for (const [_, file] of knowledge) {
        if (file.content.toLowerCase().includes(lowerQuery)) {
            results.push(file);
        }
    }

    return results;
}

/**
 * Get all knowledge
 */
export function getAllKnowledge(): KnowledgeFile[] {
    const knowledge = loadAllKnowledge();
    return Array.from(knowledge.values());
}