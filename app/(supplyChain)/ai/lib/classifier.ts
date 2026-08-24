
import { GoogleGenAI } from "@google/genai";
import { getRegisteredActions, getActionDescriptions } from './action-registry';
import { getAllKnowledge, getKnowledgeSummaries } from './knowledge-registry';

const apiKey = process.env.GEMINI_SUPPLYCHAIN_API_KEY;
const MODEL_NAME = process.env.GEMINI_SUPPLYCHAIN_MODEL || "gemini-3.5-flash-lite";

export interface Resource {
    type: 'tool' | 'knowledge';
    name: string;
}

export interface ClassificationResult {
    is_related: boolean;
    resources: Resource[];
    confidence: number;
    reason: string;
}

/**
 * Main classification function - uses AI first, falls back to keyword matching
 */
export async function classifyIntent(query: string): Promise<ClassificationResult> {

    const lowerQuery = query.toLowerCase().trim();

    const shortFollowUps = ['yes', 'no', 'ok', 'sure', 'maybe', 'tell me more', 'continue', 'go on', 'and?', 'next?', 'yeah', 'yep', 'nope'];
    if (shortFollowUps.includes(lowerQuery)) {
        return {
            is_related: true,
            resources: [{ type: 'knowledge', name: 'operations.md' }],
            confidence: 0.9,
            reason: 'Follow-up question'
        };
    }
    const mathPatterns = [
        /[0-9]\s*plus\s*[0-9]/,
        /[0-9]\s*minus\s*[0-9]/,
        /[0-9]\s*times\s*[0-9]/,
        /[0-9]\s*divided by\s*[0-9]/,
        /what is [0-9]/,
        /calculate/i,
        /math/i,
    ];

    const isMathQuery = mathPatterns.some(pattern =>
        pattern.test(query) || pattern.test(lowerQuery)
    );

    const outOfScopeTopics = [
        'weather', 'sports', 'news', 'politics', 'who won',
        'philosophy', 'history', 'geography', 'science',
        'biology', 'chemistry', 'physics', 'astronomy',
        'space', 'ocean', 'mountain', 'river', 'animal',
        'plant', 'tree', 'flower', 'music', 'movie',
        'book', 'author', 'actor', 'actress',
        'president', 'king', 'queen', 'prime minister',
        'covid', 'vaccine', 'virus', 'disease',
        'climate', 'global warming', 'environment',
    ];

    const isObviousOutOfScope = outOfScopeTopics.some(topic =>
        lowerQuery.includes(topic) ||
        lowerQuery.split(' ').every(word => word.length < 3 && !lowerQuery.includes('parcel'))
    );

    if ((isMathQuery || isObviousOutOfScope) &&
        !lowerQuery.includes('parcel') &&
        !lowerQuery.includes('inventory') &&
        !lowerQuery.includes('warehouse') &&
        !lowerQuery.includes('shipment') &&
        !lowerQuery.includes('courier')) {
        return {
            is_related: false,
            resources: [],
            confidence: 0.99,
            reason: 'Question is clearly not related to warehouse management'
        };
    }

    // Direct match for creating purchase order requests to guarantee tool execution
    if (lowerQuery.includes('create purchase order') || 
        lowerQuery.includes('create po') || 
        lowerQuery.includes('generate po') || 
        lowerQuery.includes('purchase request without po') || 
        lowerQuery.includes('pending purchase request') ||
        lowerQuery.includes('request without po') ||
        lowerQuery.includes('no purchase order')) {
        return {
            is_related: true,
            resources: [
                { type: 'tool', name: 'get_pending_purchase_requests' },
                { type: 'knowledge', name: 'procurement.md' }
            ],
            confidence: 1.0,
            reason: 'Direct match for purchase order creation workflow'
        };
    }

    if (apiKey) {
        try {
            const result = await classifyWithAI(query);
            return result;
        } catch (error) {
        }
    }

    return classifyWithKeywords(query);
}

/**
 * AI-powered classification using Gemini
 */
async function classifyWithAI(query: string): Promise<ClassificationResult> {
    const genAI = new GoogleGenAI({ apiKey });

    const prompt = `
You are an intent classifier for a Warehouse Management System.

**YOUR TASK:** Determine if the user's question is related to warehouse/freight management.

**RELATED TOPICS (always related):**
- Parcels, shipments, deliveries, couriers
- Inventory, stock, items, supplies
- Warehouse operations, receiving, sorting, dispatch
- Suppliers, procurement, purchase orders
- Performance metrics, tracking, status
- Daily operations, peak hours, sorting areas
- Questions about the system itself
- Follow-up questions (yes, no, tell me more, etc.)

**NOT RELATED TOPICS (always NOT related):**
- Math, calculations (1+1, what is 2+2, etc.)
- Sports, entertainment, celebrities
- Weather, news, current events
- Politics, religion, social issues
- Personal questions (age, location, etc.)
- General knowledge questions not about warehousing
- Science, history, geography, biology
- Philosophy, life advice

**Available Tools:**
${getActionDescriptions() || 'No tools available'}

**Available Knowledge:**
${getKnowledgeSummaries() || 'No knowledge files available'}

**User Query:** "${query}"

**IMPORTANT:** Return ONLY valid JSON. Do NOT wrap in markdown code blocks. Do NOT include any other text.

Return ONLY JSON:
{
    "is_related": true/false,
    "resources": [
        { "type": "tool|knowledge", "name": "resource_name" }
    ],
    "confidence": 0.0-1.0,
    "reason": "brief explanation"
}`;

    const interaction = await genAI.interactions.create({
        model: MODEL_NAME,
        input: prompt,
    });

    let response = interaction.output_text || '';

    response = response.replace(/```json\s*/g, '');
    response = response.replace(/```\s*/g, '');
    response = response.trim();

    if (!response) {
        throw new Error('Empty response from Gemini');
    }

    return JSON.parse(response);
}

/**
 * Fallback keyword-based classification
 */
function classifyWithKeywords(query: string): ClassificationResult {
    const lower = query.toLowerCase();

    const outOfScopePatterns = [
        '1+1', '2+2', '3+3', '4+4', '5+5',
        'what is 1', 'what is 2', 'calculate',
        'math', 'sum', 'plus', 'minus', 'times', 'divided',
        'weather', 'sports', 'news', 'politics',
        'who won', 'what is the meaning of',
        'philosophy', 'history', 'geography',
        'science', 'biology', 'chemistry',
        'physics', 'astronomy', 'space',
    ];

    const isOutOfScope = outOfScopePatterns.some(pattern => lower.includes(pattern));
    const isWarehouseRelated = lower.includes('parcel') || lower.includes('inventory') ||
        lower.includes('warehouse') || lower.includes('shipment') ||
        lower.includes('courier') || lower.includes('stock') ||
        lower.includes('receiving') || lower.includes('dispatch') ||
        lower.includes('sorting') || lower.includes('supplier');

    if (isOutOfScope && !isWarehouseRelated) {
        return {
            is_related: false,
            resources: [],
            confidence: 0.95,
            reason: 'Question is out of scope for warehouse management'
        };
    }

    const knowledgeFiles = getAllKnowledge();
    const actions = getRegisteredActions();

    const knowledgeKeywords = knowledgeFiles.flatMap(k => k.keywords);
    const actionKeywords = actions.flatMap(name =>
        name.replace(/^get_/, '').replace(/_/g, ' ').split(' ')
    );

    const allKeywords = [...knowledgeKeywords, ...actionKeywords,
        'parcel', 'parcels', 'shipment', 'shipments', 'delivery', 'courier',
        'warehouse', 'warehousing', 'inventory', 'stock', 'supplier',
        'receiving', 'sorting', 'dispatch', 'inbound', 'outgoing',
        'process', 'procedure', 'operation', 'daily', 'flow',
        'procurement', 'purchase', 'vendor', 'tracking', 'status',
        'supply chain', 'logistics', 'freight', 'container'
    ];

    const isRelated = allKeywords.some(word =>
        lower.includes(word.toLowerCase())
    );

    if (!isRelated) {
        const systemKeywords = ['system', 'application', 'platform', 'software', 'built with', 'tech stack', 'based'];
        const isSystemQuestion = systemKeywords.some(word => lower.includes(word));
        if (isSystemQuestion) {
            return {
                is_related: true,
                resources: [{ type: 'knowledge', name: 'operations.md' }],
                confidence: 0.7,
                reason: 'System question about the platform'
            };
        }

        if (lower.length < 10 && !lower.includes('parcel') && !lower.includes('inventory')) {
            return {
                is_related: false,
                resources: [],
                confidence: 0.9,
                reason: 'Question is too short or out of scope'
            };
        }
    }

    const resources: Resource[] = [];

    if (isRelated) {
        const dataKeywords = [
            'how many', 'show me', 'list', 'count', 'status', 'current',
            'history', 'historical', 'past', 'previous', 'all the',
            'give me', 'list of', 'list all', 'show all', 'get',
            'find', 'search', 'lookup', 'display'
        ];
        const isDataQuery = dataKeywords.some(word => lower.includes(word));

        if (isDataQuery) {
            for (const action of actions) {
                const actionLower = action.toLowerCase();
                const keywords = actionLower.replace(/^get_/, '').replace(/_/g, ' ');
                if (lower.includes(keywords) || lower.includes(keywords.replace(/ /g, ''))) {
                    resources.push({ type: 'tool', name: action });
                }
            }

            if (resources.length === 0) {
                if (lower.includes('parcel') || lower.includes('shipment')) {
                    resources.push({ type: 'tool', name: 'get_parcels' });
                }
                if (lower.includes('stock') || lower.includes('inventory')) {
                    resources.push({ type: 'tool', name: 'get_inventory' });
                }
                if (lower.includes('courier') || lower.includes('performance')) {
                    resources.push({ type: 'tool', name: 'get_courier_performance' });
                }
                if (lower.includes('receiving') || lower.includes('queue')) {
                    resources.push({ type: 'tool', name: 'get_receiving_queue' });
                }
                if (lower.includes('supplier')) {
                    resources.push({ type: 'tool', name: 'get_suppliers' });
                }
                if (lower.includes('create purchase order') || lower.includes('create po') || lower.includes('generate po') || lower.includes('request without po') || lower.includes('no purchase order')) {
                    resources.push({ type: 'tool', name: 'get_pending_purchase_requests' });
                } else if (lower.includes('purchase order') || lower.includes(' po') || lower.includes('spend') || lower.includes('expense') || lower.includes('orders')) {
                    resources.push({ type: 'tool', name: 'get_purchase_orders_summary' });
                }
            }
        } else {
            for (const knowledge of knowledgeFiles) {
                if (knowledge.keywords.some(kw => lower.includes(kw.toLowerCase()))) {
                    resources.push({ type: 'knowledge', name: `${knowledge.name}.md` });
                }
            }

            if (resources.length === 0) {
                const systemKeywords = ['system', 'application', 'platform', 'software', 'built with', 'tech stack', 'based'];
                if (systemKeywords.some(word => lower.includes(word))) {
                    resources.push({ type: 'knowledge', name: 'operations.md' });
                }
            }
        }

        if (resources.length === 0 && knowledgeFiles.length > 0) {
            resources.push({ type: 'knowledge', name: `${knowledgeFiles[0].name}.md` });
        }
    }

    return {
        is_related: isRelated || resources.length > 0,
        resources: resources,
        confidence: isRelated ? 0.8 : 0.95,
        reason: isRelated
            ? 'Query contains warehouse-related keywords'
            : 'Query does not contain warehouse-related keywords'
    };
}

/**
 * Quick synchronous classification (no AI call)
 */
export function quickClassify(query: string): ClassificationResult {
    return classifyWithKeywords(query);
}

/**
 * Check if a query is a follow-up question
 */
export function isFollowUp(query: string): boolean {
    const lower = query.toLowerCase().trim();
    const followUps = ['yes', 'no', 'ok', 'sure', 'maybe', 'tell me more', 'continue', 'go on', 'and?', 'next?', 'yeah', 'yep', 'nope'];
    return followUps.includes(lower);
}