
import { GoogleGenAI } from "@google/genai";

export interface GeminiResponse {
    success: boolean;
    content: string;
    model: string;
    usage: {
        totalTokens: number;
        inputTokens: number;
        outputTokens: number;
        thoughtTokens?: number;
    };
    createdAt: Date;
    error?: string;
}

export interface GeminiStreamChunk {
    type: 'chunk' | 'complete' | 'error';
    content: string;
    error?: string;
}

let geminiClient: GoogleGenAI | null = null;
const MODEL_NAME = process.env.GEMINI_SUPPLYCHAIN_MODEL || "gemini-3.5-flash-lite";

function getGeminiClient(): GoogleGenAI {
    if (!geminiClient) {
        const apiKey = process.env.GEMINI_SUPPLYCHAIN_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_SUPPLYCHAIN_API_KEY is not configured in environment variables');
        }
        geminiClient = new GoogleGenAI({ apiKey });
    }
    return geminiClient;
}

/**
 * Generate a response from Gemini (non-streaming)
 */
export async function generateResponse(
    prompt: string,
    model: string = MODEL_NAME
): Promise<GeminiResponse> {
    try {
        const ai = getGeminiClient();
        const interaction = await ai.interactions.create({
            model: model,
            input: prompt,
        });

        const content = interaction.output_text || '';

        return {
            success: true,
            content: content,
            model: interaction.model || model,
            usage: {
                totalTokens: interaction.usage?.total_tokens || 0,
                inputTokens: interaction.usage?.total_input_tokens || 0,
                outputTokens: interaction.usage?.total_output_tokens || 0,
                thoughtTokens: interaction.usage?.total_thought_tokens || 0,
            },
            createdAt: interaction.created ? new Date(interaction.created) : new Date(),
        };

    } catch (error) {
        return {
            success: false,
            content: '',
            model: model,
            usage: { totalTokens: 0, inputTokens: 0, outputTokens: 0 },
            createdAt: new Date(),
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
    }
}

export async function* generateStreamingResponse(
    prompt: string,
    model: string = MODEL_NAME
): AsyncGenerator<GeminiStreamChunk, void, unknown> {
    try {
        const ai = getGeminiClient();

        const stream = await ai.interactions.create({
            model: model,
            input: prompt,
            stream: true,
        });

        let fullContent = '';

        for await (const event of stream) {

            let chunk = '';

            if (event && typeof event === 'object') {
                if ('output_text' in event && event.output_text) {
                    chunk = String(event.output_text);
                }
                else if ('steps' in event && Array.isArray(event.steps)) {
                    const step = event.steps[0];
                    if (step && typeof step === 'object') {
                        if ('content' in step && Array.isArray(step.content)) {
                            const contentItem = step.content[0];
                            if (contentItem && typeof contentItem === 'object' && 'text' in contentItem) {
                                chunk = String(contentItem.text);
                            }
                        }
                        else if ('text' in step && step.text) {
                            chunk = String(step.text);
                        }
                    }
                }
                else if ('content' in event && event.content) {
                    if (typeof event.content === 'string') {
                        chunk = event.content;
                    } else if (Array.isArray(event.content) && event.content[0]?.text) {
                        chunk = String(event.content[0].text);
                    }
                }
                else if ('delta' in event && event.delta) {
                    if (typeof event.delta === 'string') {
                        chunk = event.delta;
                    } else if (typeof event.delta === 'object' && 'text' in event.delta) {
                        chunk = String(event.delta.text);
                    }
                }
                else if ('text' in event && event.text) {
                    chunk = String(event.text);
                }
            }

            if (chunk && typeof chunk === 'string' && chunk.trim()) {
                fullContent += chunk;
                yield {
                    type: 'chunk',
                    content: chunk,
                };
            } else {
            }
        }

        yield {
            type: 'complete',
            content: fullContent,
        };

    } catch (error) {
        yield {
            type: 'error',
            content: '',
            error: error instanceof Error ? error.message : 'Unknown streaming error',
        };
    }
}

/**
 * Generate a simple response without the full metadata
 */
export async function generateSimpleResponse(
    prompt: string,
    model: string = MODEL_NAME
): Promise<string> {
    const response = await generateResponse(prompt, model);
    if (!response.success) {
        throw new Error(response.error || 'Failed to generate response');
    }
    return response.content;
}

/**
 * Check if Gemini is properly configured
 */
export function isAIAvailable(): boolean {
    return !!process.env.GEMINI_SUPPLYCHAIN_API_KEY;
}


/**
 * Generate a response with knowledge context
 */
export async function generateResponseWithContext(
    prompt: string,
    context: string,
    model: string = MODEL_NAME
): Promise<GeminiResponse> {
    const fullPrompt = `
You are a warehouse management assistant. Answer the user's question using the provided context.

Context:
${context}

User Question: ${prompt}

Instructions:
1. Use the context to answer the question
2. If the context doesn't contain the answer, say "I don't have that information in my knowledge base"
3. Be helpful and concise
4. Format responses clearly
`;

    return generateResponse(fullPrompt, model);
}