import { classifyIntent } from './classifier';
import { searchKnowledge, getKnowledge, getKnowledgeSummaries } from './knowledge-registry';
import { registerAllActions, executeAction, executeMatchingActions, getRegisteredActions } from './action-registry';
import { GoogleGenAI } from '@google/genai';
import { checkModeration, ModerationContext } from './moderation';

const apiKey = process.env.GEMINI_SUPPLYCHAIN_API_KEY;
const MODEL_NAME = process.env.GEMINI_SUPPLYCHAIN_MODEL || 'gemini-3.5-flash-lite';

registerAllActions();

export interface OrchestratorResult {
    success: boolean;
    response: string;
    classification: any;
    resourcesUsed: any[];
    actionResults: any;
    knowledgeUsed: any[];
    error?: string;
    thinking?: string;
    suggestions?: string[];
    moderation?: {
        isViolation: boolean;
        violationType?: 'inappropriate' | 'gibberish';
        strikeCount: number;
        maxStrikes: number;
        isLockedOut: boolean;
        lockoutRemainingSeconds: number;
    };
}
export interface QueryAnalysis {
    type: 'data' | 'process' | 'analysis' | 'comparison' | 'summary' | 'general';
    complexity: 'simple' | 'moderate' | 'complex';
    needsContext: boolean;
    needsCalculation: boolean;
    needsComparison: boolean;
}
/**
 * Analyze the query to determine approach
 */
function analyzeQuery(query: string): QueryAnalysis {
    const lower = query.toLowerCase();
    let type: QueryAnalysis['type'] = 'general';
    if (lower.includes('how many') || lower.includes('count') || lower.includes('list') || lower.includes('show')) {
        type = 'data';
    }
    else if (lower.includes('how') || lower.includes('why') || lower.includes('explain') || lower.includes('describe')) {
        type = 'process';
    }
    else if (lower.includes('compare') || lower.includes('versus') || lower.includes('vs')) {
        type = 'comparison';
    }
    else if (lower.includes('analyze') || lower.includes('insight') || lower.includes('trend')) {
        type = 'analysis';
    }
    else if (lower.includes('summary') || lower.includes('overview') || lower.includes('recap')) {
        type = 'summary';
    }
    let complexity: QueryAnalysis['complexity'] = 'simple';
    const complexityWords = ['analyze', 'compare', 'trend', 'pattern', 'relationship', 'optimize', 'improve', 'suggest', 'recommend'];
    if (complexityWords.some(word => lower.includes(word))) {
        complexity = 'complex';
    }
    else if (lower.split(' ').length > 10) {
        complexity = 'moderate';
    }
    return {
        type,
        complexity,
        needsContext: lower.includes('context') || lower.includes('background'),
        needsCalculation: lower.includes('calculate') || lower.includes('compute') || lower.includes('total'),
        needsComparison: lower.includes('compare') || lower.includes('versus') || lower.includes('vs'),
    };
}
/**
 * Build a flexible prompt based on query analysis and user role access
 */
function buildFlexiblePrompt(query: string, analysis: QueryAnalysis, knowledgeContext: string, actionResults: any, historyContext: string, resourcesUsed: any[], userRole: string = "User"): string {
    let systemPrompt = `You are an AI assistant for the Airship Express Supply Chain Management system.

**Role-Based Access Control Rules:**
You are communicating with a user whose authorized system access level is "${userRole}".
Each functional module and page has strict access permissions:
- Executive Overview (KPIs, executive intelligence, overall macro metrics, executive financial summaries): Accessible ONLY to Executive or Admin.
- User Activities, System Sessions, Device Audits, Security Controls: Accessible ONLY to Executive or Admin.
- Procurement & Purchase Orders (Supplier contracts, PO costs, approvals): Accessible to Executive, Admin, Manager, and authorized Employee.
- Warehousing (Receiving, Sorting, Outgoing, Dispatch, Inventory): Accessible to Executive, Admin, Manager, Operator, Employee.

**CRITICAL INSTRUCTIONS FOR ACCESS CONTROL:**
1. If the user asks about a page, dataset, metrics, or information that is outside their authorized access level (for example, if a non-Executive/non-Admin asks about the Executive Overview or financial KPIs, or an unauthorized role asks about protected areas):
   - You MUST deny access dynamically and naturally.
   - Example responses:
     - "You are not authorized to view or access this information."
     - "You do not have permission to view this page or its records."
     - "I cannot find this information or you may not have access to view it."
     - "This section is not accessible from your current account."
   - NEVER mention role names (e.g. do NOT say "You need to be an Executive" or "Your role is Operator").
   - NEVER explain which roles have access to what. Simply state that the page/data is not accessible or not permitted.
2. If the user is authorized for the requested data/page, provide a clear, helpful, and accurate response based on the Knowledge Base and Live Data.

**User Query Analysis:**
- Type: ${analysis.type}
- Complexity: ${analysis.complexity}
- Needs Context: ${analysis.needsContext ? 'Yes' : 'No'}
- Needs Calculation: ${analysis.needsCalculation ? 'Yes' : 'No'}

`;
    if (knowledgeContext) {
        systemPrompt += `**Knowledge Base:**
${knowledgeContext}

`;
    }
    if (actionResults && Object.keys(actionResults).length > 0) {
        systemPrompt += `**Live Data from Database:**
${JSON.stringify(actionResults, null, 2)}

**Interactive Actions Guidance:**
- When 'get_pending_purchase_requests' is returned, provide an organized overview of the purchase requests awaiting purchase order creation (mentioning request numbers, supplier name, and items). The system UI will automatically render interactive selectable cards for Manager, Admin, and Executive users so they can select requests, create draft purchase orders, review them, and choose to send via Gmail.
- When 'get_low_stock' or low stock/out-of-stock items are returned, provide a concise summary of the items requiring replenishment (highlighting out-of-stock vs low-stock). Inform the user that the system UI displays interactive reordering cards below where Admin, Executive, and Manager users can select all or specific items, customize reorder quantities, and generate Purchase Requests, which will automatically send notifications to Admin and Executive dashboards for review and approval.
- Remind users that once generated, the purchase requests are saved as Pending and can be reviewed in the Procurement module.

`;
    }
    if (historyContext) {
        systemPrompt += `**Previous Conversation:**
${historyContext}

    **IMPORTANT:** The user's current question is a follow-up. Use the conversation history to understand the context. 
    If the user said "yes" or "no" or a short response, refer back to the previous topic.

`;
    }
    switch (analysis.type) {
        case 'data':
            systemPrompt += `**Instructions for Data Query:**
1. Present the data clearly and concisely
2. If there are numbers, highlight key figures
3. If there are trends, point them out
4. Format as a clean list or table
5. Include totals where relevant

`;
            break;
        case 'process':
            systemPrompt += `**Instructions for Process Query:**
1. Explain the process step by step
2. Break down complex steps into simple parts
3. Include "why" each step is important
4. Mention any best practices
5. Suggest improvements if applicable

`;
            break;
        case 'analysis':
            systemPrompt += `**Instructions for Analysis Query:**
1. Analyze the data deeply
2. Identify patterns and trends
3. Provide insights and conclusions
4. Compare with benchmarks if possible
5. Make data-driven recommendations
6. Consider multiple perspectives

`;
            break;
        case 'comparison':
            systemPrompt += `**Instructions for Comparison Query:**
1. Compare items clearly (side-by-side if possible)
2. Highlight key differences and similarities
3. Explain the significance of differences
4. Provide recommendations based on comparison
5. Use pros and cons format if applicable

`;
            break;
        case 'summary':
            systemPrompt += `**Instructions for Summary Query:**
1. Provide a clear, concise overview
2. Highlight the most important points
3. Include key metrics if available
4. Use bullet points for clarity
5. End with a brief conclusion

`;
            break;
        default:
            systemPrompt += `**Instructions for General Query:**
1. Be helpful and thorough
2. Use the available data and knowledge
3. Ask clarifying questions if needed
4. Provide actionable information
5. Keep it professional and clear

`;
    }
    if (analysis.complexity === 'complex') {
        systemPrompt += `**Complex Query Handling:**
1. Take a moment to think through the problem
2. Break it down into smaller parts
3. Consider multiple approaches
4. Provide a well-structured response
5. If data is insufficient, suggest what would help

`;
    }
    else if (analysis.complexity === 'moderate') {
        systemPrompt += `**Moderate Query Handling:**
1. Provide a balanced response
2. Include both overview and details
3. Be concise but thorough
4. Highlight key takeaways

`;
    }
    systemPrompt += `**Final Instructions:**
1. Use plain text (no Markdown: no *, #, **, etc.)
2. Be professional but conversational
3. If you don't have enough information, say so
4. Suggest follow-up questions if appropriate
5. Keep the response focused on the user's needs
6. For follow-up questions, continue the previous topic naturally

**User Question:** ${query}

**Answer:`;
    return systemPrompt;
}
/**
 * Generate follow-up suggestions
 */
function generateSuggestions(query: string, analysis: QueryAnalysis, hasData: boolean): string[] {
    const suggestions: string[] = [];
    const lower = query.toLowerCase();
    switch (analysis.type) {
        case 'data':
            if (lower.includes('parcel') || lower.includes('shipment')) {
                suggestions.push('Show me parcel trends over time');
                suggestions.push('What\'s the best performing courier?');
                suggestions.push('Compare parcel volumes by destination');
            }
            if (lower.includes('stock') || lower.includes('inventory')) {
                suggestions.push('Show me items that need reordering');
                suggestions.push('What\'s the total inventory value?');
                suggestions.push('Which items move fastest?');
            }
            break;
        case 'process':
            suggestions.push('Show me a step-by-step guide');
            suggestions.push('What are the best practices?');
            suggestions.push('How can I improve this process?');
            break;
        case 'analysis':
            suggestions.push('What are the key trends?');
            suggestions.push('Can you provide more detailed data?');
            suggestions.push('How does this compare to benchmarks?');
            break;
        case 'summary':
            suggestions.push('Can you provide more details on specific areas?');
            suggestions.push('What are the most important takeaways?');
            suggestions.push('Show me the data behind this summary');
            break;
    }
    if (hasData) {
        suggestions.push('Show me the raw data');
        suggestions.push('Export this data');
    }
    suggestions.push('Tell me more');
    return suggestions.slice(0, 4);
}
/**
 * Handle system-related questions
 */
function handleSystemQuestion(query: string): string | null {
    const lower = query.toLowerCase().trim();
    const mathPatterns = [
        /[0-9]\s*[\+\-\*\/]\s*[0-9]/,
        /[0-9]\s*plus\s*[0-9]/,
        /[0-9]\s*minus\s*[0-9]/,
    ];
    if (mathPatterns.some(pattern => pattern.test(lower))) {
        return null;
    }
    const systemPatterns = [
        'what is this system',
        'what system is this',
        'tell me about this system',
        'how does this system work',
        'is it based',
        'is this system',
        'is it base',
        'what technology',
        'what stack',
        'how was this built',
        'what can you do',
        'what are your capabilities',
        'tell me about yourself',
        'what features',
        'what modules',
        'what are the features',
        'technology stack',
        'tech stack',
        'built with',
        'what is this',
        'explain this system',
        'about this system',
        'system details',
        'what do you do',
        'how can you help',
        'what can you help with',
    ];
    const dataPatterns = [
        'parcel', 'parcels', 'shipment', 'shipments', 'delivery',
        'stock', 'inventory', 'courier', 'performance',
        'receiving', 'queue', 'history', 'historical',
        'list', 'show me', 'give me', 'all the',
        'total', 'count', 'how many', 'status', 'current',
        'find', 'search', 'lookup', 'display',
        'today', 'yesterday', 'this week', 'this month'
    ];
    const isDataQuery = dataPatterns.some(pattern => lower.includes(pattern));
    if (isDataQuery) {
        return null;
    }
    const isSystemQuestion = systemPatterns.some(pattern => lower.includes(pattern));
    if (!isSystemQuestion) {
        return null;
    }
    const knowledgeSummaries = getKnowledgeSummaries();
    const actions = getRegisteredActions();
    return `This is a **Warehouse Management System** built with:

**Technology Stack:**
- Next.js 15+ (App Router)
- TypeScript
- Tailwind CSS
- Supabase (PostgreSQL)
- Google Gemini AI

**Key Features:**
1. **Parcel Management** - Track, receive, sort, and dispatch parcels
2. **Inventory Management** - Monitor stock levels, low stock alerts
3. **Courier Performance** - Track on-time delivery and metrics
4. **Warehouse Operations** - Manage daily processes and procedures
5. **Procurement** - Supplier management and purchase orders

**Available Tools:**
${actions.map(a => `- ${a}`).join('\n')}

**Knowledge Base:**
${knowledgeSummaries || 'No knowledge files loaded'}

**AI Capabilities:**
- Intelligent assistant powered by Google Gemini
- Knowledge base from your warehouse documentation
- Real-time data from your Supabase database
- Auto-detects new tools and knowledge

**How can I help you today?**`;
}
/**
 * Build the system prompt (EXPORTED for streaming)
 */
export async function buildSystemPrompt(query: string, history: any[] = [], userRole: string = "User") {
    const systemResponse = handleSystemQuestion(query);
    if (systemResponse) {
        return {
            classification: { is_related: true, reason: 'System question' },
            prompt: null,
            isRelated: true,
            response: systemResponse,
            actionResults: null,
            knowledgeUsed: [],
            resourcesUsed: [],
            suggestions: ['What features interest you most?', 'How can I help you today?'],
        };
    }
    const analysis = analyzeQuery(query);
    const classification = await classifyIntent(query);
    if (!classification.is_related) {
        return {
            classification,
            prompt: null,
            isRelated: false,
            response: "I'm a warehouse management assistant. I can only help with topics like:\n\n" +
                "Parcel Management - Tracking, receiving, sorting, dispatch\n" +
                "Inventory - Stock levels, low stock alerts\n" +
                "Courier Performance - On-time delivery, metrics\n" +
                "Warehouse Operations - Processes, procedures\n" +
                "Procurement - Suppliers, purchase orders\n\n" +
                "Please ask about these topics!",
            actionResults: null,
            knowledgeUsed: [],
            resourcesUsed: [],
        };
    }
    const actionResults = await executeMatchingActions(query);
    // Also execute any specific tools directly identified by classification
    const toolResources = classification.resources?.filter(r => r.type === 'tool') || [];
    for (const tool of toolResources) {
        if (!actionResults[tool.name]) {
            try {
                const res = await executeAction(tool.name, query);
                actionResults[tool.name] = res;
            }
            catch (e: any) {
                console.error(`Error executing tool ${tool.name}:`, e);
            }
        }
    }
    let knowledgeResults: any[] = [];
    const knowledgeResources = classification.resources?.filter(r => r.type === 'knowledge') || [];
    for (const knowledge of knowledgeResources) {
        const content = getKnowledge(knowledge.name.replace('.md', ''));
        if (content) {
            knowledgeResults.push(content);
        }
    }
    if (knowledgeResults.length === 0) {
        const searchResults = searchKnowledge(query);
        if (searchResults.length > 0) {
            knowledgeResults = searchResults.slice(0, 5);
        }
    }
    const knowledgeContext = knowledgeResults.map(k => k.content).join('\n\n---\n\n');
    let historyContext = '';
    if (history && history.length > 0) {
        const recentHistory = history.slice(-5);
        historyContext = recentHistory
            .map((msg: any) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
            .join('\n');
    }
    const systemPrompt = buildFlexiblePrompt(query, analysis, knowledgeContext, actionResults, historyContext, classification.resources || [], userRole);
    return {
        classification,
        prompt: systemPrompt,
        isRelated: true,
        actionResults,
        knowledgeUsed: knowledgeResults,
        resourcesUsed: classification.resources || [],
        analysis,
        suggestions: generateSuggestions(query, analysis, Object.keys(actionResults).length > 0),
    };
}
/**
 * Main orchestrator with Moderation, Strike Tracking & 5-minute lockout
 */
export async function orchestrator(
    query: string, 
    history: any[] = [], 
    userRole: string = "User",
    context: ModerationContext = {}
): Promise<OrchestratorResult> {
    try {
        // 1. Content Moderation & 5-minute Lockout Pre-check
        const moderation = await checkModeration(query, context);
        if (!moderation.isAllowed) {
            return {
                success: true,
                response: moderation.message || "Your query has been restricted by content moderation policies.",
                classification: { is_related: false, reason: 'Moderation policy triggered' },
                resourcesUsed: [],
                actionResults: null,
                knowledgeUsed: [],
                thinking: `Moderation triggered (Strike ${moderation.strikeCount}/${moderation.maxStrikes}, LockedOut: ${moderation.isLockedOut})`,
                suggestions: ['Ask about parcel tracking', 'Ask about inventory stock', 'Ask about procurement procedures'],
                moderation: {
                    isViolation: true,
                    violationType: moderation.violationType,
                    strikeCount: moderation.strikeCount,
                    maxStrikes: moderation.maxStrikes,
                    isLockedOut: moderation.isLockedOut,
                    lockoutRemainingSeconds: moderation.lockoutRemainingSeconds,
                }
            };
        }
        const lowerQuery = query.toLowerCase().trim();
        const shortFollowUps = ['yes', 'no', 'ok', 'sure', 'maybe', 'tell me more', 'continue', 'go on', 'and?', 'next?', 'yeah', 'yep', 'nope'];
        const isFollowUp = history.length > 0 &&
            (shortFollowUps.includes(lowerQuery) ||
                lowerQuery.length < 10 && !lowerQuery.includes('parcel') && !lowerQuery.includes('inventory'));
        if (isFollowUp) {
            const lastMessages = history.slice(-5);
            const context = lastMessages
                .map((msg: any) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
                .join('\n');
            const genAI = new GoogleGenAI({ apiKey });
            const contextualPrompt = `You are a warehouse management assistant for Airship Express. Continue the conversation naturally.
The user has system access level "${userRole}". If they follow up asking about unauthorized or restricted areas, dynamically state that the page/data is not accessible without mentioning role names.

Previous conversation:
${context}

User's follow-up: "${query}"

Instructions:
1. If the user said "yes", provide more details about the previous topic
2. If they said "no", ask what they'd like to know instead
3. If they said "tell me more", elaborate on the previous topic
4. Keep the response natural and conversational
5. Do NOT list out-of-scope topics
6. Do NOT mention roles or permission level names in the answer

Response:`;
            const response = await genAI.interactions.create({
                model: MODEL_NAME,
                input: contextualPrompt,
            });
            const answer = response.output_text || '';
            return {
                success: true,
                response: answer,
                classification: { is_related: true, reason: 'Follow-up question' },
                resourcesUsed: [],
                actionResults: null,
                knowledgeUsed: [],
                thinking: 'Follow-up response',
                suggestions: ['Tell me more', 'What else?', 'Explain that further'],
            };
        }
        const result = await buildSystemPrompt(query, history, userRole);
        if (!result.isRelated) {
            return {
                success: true,
                response: result.response || "I can't help with that.",
                classification: result.classification,
                resourcesUsed: [],
                actionResults: null,
                knowledgeUsed: [],
                thinking: 'Query out of scope',
                suggestions: ['Try asking about parcels', 'Try asking about inventory'],
            };
        }
        if (result.response && !result.prompt) {
            return {
                success: true,
                response: result.response,
                classification: result.classification,
                resourcesUsed: [],
                actionResults: null,
                knowledgeUsed: [],
                thinking: 'System question detected',
                suggestions: result.suggestions || ['What features interest you most?', 'How can I help you today?'],
            };
        }
        if (!result.prompt) {
            return {
                success: false,
                response: 'I encountered an issue generating a response. Please try again.',
                classification: result.classification,
                resourcesUsed: [],
                actionResults: null,
                knowledgeUsed: [],
                error: 'Prompt is null',
                suggestions: ['Try rephrasing your question'],
            };
        }
        const genAI = new GoogleGenAI({ apiKey });
        const response = await genAI.interactions.create({
            model: MODEL_NAME,
            input: result.prompt,
        });
        const answer = response.output_text || '';
        return {
            success: true,
            response: answer,
            classification: result.classification,
            resourcesUsed: result.resourcesUsed || [],
            actionResults: result.actionResults || null,
            knowledgeUsed: result.knowledgeUsed || [],
            thinking: `Query type: ${result.analysis?.type || 'general'}, Complexity: ${result.analysis?.complexity || 'simple'}`,
            suggestions: result.suggestions || ['Tell me more', 'What else would you like to know?'],
        };
    }
    catch (error) {
        return {
            success: false,
            response: 'Sorry, I encountered an error processing your request. Please try again.',
            classification: null,
            resourcesUsed: [],
            actionResults: null,
            knowledgeUsed: [],
            error: error instanceof Error ? error.message : 'Unknown error',
            suggestions: ['Try rephrasing your question', 'Try asking something simpler'],
        };
    }
}
