
import fs from 'fs';
import path from 'path';

export interface KnowledgeFile {
    name: string;
    content: string;
    path: string;
    category: string;
    keywords: string[];
}

const knowledgeRegistry = new Map<string, KnowledgeFile>();
let isLoaded = false;

/**
 * Auto-discover and load all knowledge files from the knowledge folder
 */
export function loadAllKnowledge(): Map<string, KnowledgeFile> {
    if (isLoaded && knowledgeRegistry.size > 0) {
        return knowledgeRegistry;
    }

    knowledgeRegistry.clear();

    const knowledgeDir = path.join(process.cwd(), 'app/(supplyChain)/ai/knowledge');


    if (!fs.existsSync(knowledgeDir)) {
        loadFallbackKnowledge();
        return knowledgeRegistry;
    }

    const files = fs.readdirSync(knowledgeDir);

    for (const file of files) {
        if (!file.endsWith('.md')) continue;

        try {
            const filePath = path.join(knowledgeDir, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            const name = file.replace('.md', '');

            const keywords = [
                name,
                ...name.split('_'),
                ...name.split('-'),
            ];

            const categoryMatch = content.match(/^#\s+(.+)$/m);
            const category = categoryMatch ? categoryMatch[1] : 'general';

            knowledgeRegistry.set(name, {
                name,
                content,
                path: filePath,
                category,
                keywords,
            });

        } catch (error) {
        }
    }

    if (knowledgeRegistry.size === 0) {
        loadFallbackKnowledge();
    }

    isLoaded = true;
    return knowledgeRegistry;
}

/**
 * Load fallback knowledge when no files exist
 */
function loadFallbackKnowledge(): void {
    const fallbackKnowledge: Record<string, string> = {
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

    for (const [name, content] of Object.entries(fallbackKnowledge)) {
        knowledgeRegistry.set(name, {
            name,
            content,
            path: 'fallback',
            category: 'general',
            keywords: name.split('_'),
        });
    }
}

/**
 * Get a specific knowledge file by name
 */
export function getKnowledge(name: string): KnowledgeFile | null {
    const allKnowledge = loadAllKnowledge();
    return allKnowledge.get(name) || null;
}

/**
 * Search knowledge files for relevant content
 */
export function searchKnowledge(query: string): KnowledgeFile[] {
    const allKnowledge = loadAllKnowledge();
    const lowerQuery = query.toLowerCase();
    const results: KnowledgeFile[] = [];

    for (const [_, file] of allKnowledge) {
        const contentLower = file.content.toLowerCase();
        const contentMatch = lowerQuery.split(' ')
            .filter(word => word.length > 2)
            .some(term => contentLower.includes(term));

        const keywordMatch = file.keywords.some(kw =>
            lowerQuery.includes(kw.toLowerCase())
        );

        if (contentMatch || keywordMatch) {
            results.push(file);
        }
    }

    results.sort((a, b) => {
        const aScore = a.content.length;
        const bScore = b.content.length;
        return bScore - aScore;
    });

    return results.slice(0, 5);
}

/**
 * Get all knowledge files
 */
export function getAllKnowledge(): KnowledgeFile[] {
    const allKnowledge = loadAllKnowledge();
    return Array.from(allKnowledge.values());
}

/**
 * Get knowledge summaries (for AI prompt)
 */
export function getKnowledgeSummaries(): string {
    const allKnowledge = loadAllKnowledge();
    const summaries: string[] = [];

    for (const [name, file] of allKnowledge) {
        const preview = file.content.substring(0, 150).replace(/\n/g, ' ');
        summaries.push(`- ${name}.md: ${file.category} - ${preview}...`);
    }

    return summaries.join('\n');
}