import { NextRequest } from "next/server";
import { buildSystemPrompt } from "../../../lib/orchestrator";
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_SUPPLYCHAIN_API_KEY;
const MODEL_NAME = process.env.GEMINI_SUPPLYCHAIN_MODEL || "gemini-3.5-flash-lite";

const STREAM_CONFIG = {
    MIN_CHUNK_DELAY: 20,
    CHARS_PER_CHUNK: 3,
};

// ... existing imports and config ...

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { question, history, role } = body;

        if (!question || typeof question !== 'string') {
            return new Response(
                JSON.stringify({ error: "Question is required" }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const result = await buildSystemPrompt(question, history, role);

        if (!result.isRelated || (result.response && !result.prompt)) {
            const text = result.response || 'Out of scope';
            const stream = new ReadableStream({
                start(controller) {
                    const chars = text.split('');
                    let index = 0;
                    let isClosed = false;

                    const interval = setInterval(() => {
                        // Check if controller is already closed
                        if (isClosed) {
                            clearInterval(interval);
                            return;
                        }

                        try {
                            if (index < chars.length) {
                                const chunk = chars.slice(index, index + STREAM_CONFIG.CHARS_PER_CHUNK).join('');
                                const full = text.substring(0, index + STREAM_CONFIG.CHARS_PER_CHUNK);

                                controller.enqueue(`data: ${JSON.stringify({
                                    type: 'chunk',
                                    content: chunk,
                                    full: full,
                                })}\n\n`);
                                index += STREAM_CONFIG.CHARS_PER_CHUNK;
                            } else {
                                clearInterval(interval);
                                isClosed = true;
                                controller.enqueue(`data: ${JSON.stringify({
                                    type: 'done',
                                    content: text,
                                    meta: {
                                        suggestions: result.suggestions || [],
                                        classification: result.classification,
                                    }
                                })}\n\n`);
                                controller.close();
                            }
                        } catch (error) {
                            clearInterval(interval);
                            isClosed = true;
                            // Only try to close if not already closed
                            try {
                                controller.close();
                            } catch (e) {
                                // Ignore if already closed
                            }
                        }
                    }, STREAM_CONFIG.MIN_CHUNK_DELAY);
                }
            });

            return new Response(stream, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'X-Accel-Buffering': 'no',
                },
            });
        }

        if (!result.prompt) {
            throw new Error('No prompt available for Gemini');
        }

        const genAI = new GoogleGenAI({ apiKey });
        const streamResponse = await genAI.interactions.create({
            model: MODEL_NAME,
            input: result.prompt,
            stream: true,
        });

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    let fullContent = '';
                    let chunkCount = 0;
                    const chunks: string[] = [];
                    let isClosed = false;

                    controller.enqueue(`data: ${JSON.stringify({
                        type: 'status',
                        content: 'Generating response...',
                    })}\n\n`);

                    for await (const event of streamResponse) {
                        // Check if controller is closed
                        if (isClosed) break;

                        let chunk: string = '';

                        // SKIP thought signature events
                        if (event && typeof event === 'object' && 'type' in event && event.type === 'thought_signature') {
                            continue;
                        }

                        if (event && typeof event === 'object') {
                            // Check for output_text
                            if ('output_text' in event && event.output_text) {
                                chunk = String(event.output_text);
                            }
                            // Check for steps array
                            else if ('steps' in event && Array.isArray(event.steps)) {
                                for (const step of event.steps) {
                                    if (step?.type === 'thought_signature') continue;
                                    if (step?.content && Array.isArray(step.content)) {
                                        for (const contentItem of step.content) {
                                            if (contentItem && typeof contentItem === 'object' && 'text' in contentItem) {
                                                chunk += String(contentItem.text);
                                            }
                                        }
                                    }
                                }
                            }
                            // Check for content directly
                            else if ('content' in event && event.content) {
                                if (typeof event.content === 'string') {
                                    chunk = event.content;
                                } else if (Array.isArray(event.content)) {
                                    for (const item of event.content) {
                                        if (item && typeof item === 'object' && 'text' in item) {
                                            chunk += String(item.text);
                                        }
                                    }
                                }
                            }
                            // Check for delta
                            else if ('delta' in event && event.delta) {
                                if (typeof event.delta === 'string') {
                                    chunk = event.delta;
                                } else if (event.delta && typeof event.delta === 'object') {
                                    if ('text' in event.delta && event.delta.text) {
                                        chunk = String(event.delta.text);
                                    } else if ('content' in event.delta && event.delta.content) {
                                        chunk = String(event.delta.content);
                                    }
                                }
                            }
                            // Check for text directly
                            else if ('text' in event && event.text) {
                                chunk = String(event.text);
                            }
                        }

                        // FIX: Check if chunk is a string before using includes
                        if (chunk && typeof chunk === 'string' && chunk.length > 0) {
                            // Skip chunks containing signature data
                            if (chunk.includes('thought_signature') || chunk.includes('signature')) {
                                continue;
                            }
                            chunks.push(chunk);
                            fullContent += chunk;
                            chunkCount++;
                        }
                    }

                    // Check if controller is still open before proceeding
                    if (isClosed) return;

                    if (chunkCount === 0 || fullContent.length === 0) {
                        const fallbackText = 'I apologize, but I encountered an issue generating a response. Please try again.';
                        const chars = fallbackText.split('');
                        let index = 0;

                        const interval = setInterval(() => {
                            // Check if closed
                            if (isClosed) {
                                clearInterval(interval);
                                return;
                            }

                            try {
                                if (index < chars.length) {
                                    const chunk = chars.slice(index, index + STREAM_CONFIG.CHARS_PER_CHUNK).join('');
                                    const full = fallbackText.substring(0, index + STREAM_CONFIG.CHARS_PER_CHUNK);

                                    controller.enqueue(`data: ${JSON.stringify({
                                        type: 'chunk',
                                        content: chunk,
                                        full: full,
                                    })}\n\n`);
                                    index += STREAM_CONFIG.CHARS_PER_CHUNK;
                                } else {
                                    clearInterval(interval);
                                    isClosed = true;
                                    controller.enqueue(`data: ${JSON.stringify({
                                        type: 'done',
                                        content: fallbackText,
                                        meta: {
                                            suggestions: result.suggestions || [],
                                            classification: result.classification,
                                        }
                                    })}\n\n`);
                                    controller.close();
                                }
                            } catch (error) {
                                clearInterval(interval);
                                isClosed = true;
                                try {
                                    controller.close();
                                } catch (e) {
                                    // Ignore
                                }
                            }
                        }, STREAM_CONFIG.MIN_CHUNK_DELAY);
                        return;
                    }

                    // Smoothly stream the collected content character by character
                    const fullText = fullContent;
                    const chars = fullText.split('');
                    let charIndex = 0;

                    const interval = setInterval(() => {
                        // Check if closed
                        if (isClosed) {
                            clearInterval(interval);
                            return;
                        }

                        try {
                            if (charIndex < chars.length) {
                                const chunk = chars.slice(charIndex, charIndex + STREAM_CONFIG.CHARS_PER_CHUNK).join('');
                                const currentFull = fullText.substring(0, charIndex + STREAM_CONFIG.CHARS_PER_CHUNK);

                                controller.enqueue(`data: ${JSON.stringify({
                                    type: 'chunk',
                                    content: chunk,
                                    full: currentFull,
                                })}\n\n`);
                                charIndex += STREAM_CONFIG.CHARS_PER_CHUNK;
                            } else {
                                clearInterval(interval);
                                isClosed = true;
                                controller.enqueue(`data: ${JSON.stringify({
                                    type: 'done',
                                    content: fullText,
                                    totalChunks: chunkCount,
                                    meta: {
                                        classification: result.classification,
                                        resourcesUsed: result.resourcesUsed,
                                        actionResults: result.actionResults,
                                        knowledgeUsed: result.knowledgeUsed?.map((k: any) => k.name),
                                        suggestions: result.suggestions || [],
                                    }
                                })}\n\n`);
                                controller.close();
                            }
                        } catch (error) {
                            clearInterval(interval);
                            isClosed = true;
                            try {
                                controller.close();
                            } catch (e) {
                                // Ignore
                            }
                        }
                    }, STREAM_CONFIG.MIN_CHUNK_DELAY);

                } catch (error) {
                    try {
                        controller.enqueue(`data: ${JSON.stringify({
                            type: 'error',
                            content: error instanceof Error ? error.message : 'Unknown error',
                        })}\n\n`);
                        controller.close();
                    } catch (e) {
                        // Ignore if controller is already closed
                    }
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',
            },
        });

    } catch (error) {
        const errorStream = new ReadableStream({
            start(controller) {
                try {
                    controller.enqueue(`data: ${JSON.stringify({
                        type: 'error',
                        content: error instanceof Error ? error.message : 'Unknown error',
                    })}\n\n`);
                    controller.close();
                } catch (e) {
                    // Ignore
                }
            }
        });

        return new Response(errorStream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    }
}