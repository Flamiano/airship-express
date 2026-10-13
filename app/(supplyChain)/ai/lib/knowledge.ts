
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

    const fallback: Record<string, string> = {
        'warehousing': `
# Warehouse Operations

## Inbound Stocking
- Stock received from approved suppliers
- Quantity and condition verification against Purchase Orders
- Putaway into assigned warehouse racks and bins
- Status: Received → Inspected → Stocked

## Storage Layout
- Categorized by equipment type and hazard rating
- Racks, bays, and aisles tracked in system
- Real-time stock movement audits

## Outgoing Issue
- Department requisitions approved
- Items picked and logged with purpose and recipient
- Inventory balance updated automatically
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
- Active Storage Zones: 4/4 active
- Average Stock Processing Time: 1h 15m
- Requisitions per day: ~150

## Processes
1. Receive goods from suppliers
2. Inspect and verify against PO
3. Put away into assigned bin/rack
4. Issue materials upon approved request
5. Log stock movement
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