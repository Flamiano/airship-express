// app/components/ai/AIChatbot.tsx

"use client";

import { useState, useRef, useEffect } from "react";
import { useAI } from "./AIContext";
//  Import robot components
import { RobotAvatar, RobotHeader } from "../components";
import { motion } from "framer-motion";

interface Message {
    id: string;
    type: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    isThinking?: boolean;
    suggestions?: string[];
}

interface AIChatbotProps {
    isOpen: boolean;
    onClose: () => void;
}

const SUGGESTED_QUESTIONS = [
    "What's the current inventory status?",
    "Show me low stock items",
    "What is the process of warehousing?",
    "Give me all parcels history",
];

function stripMarkdown(text: string): string {
    if (!text) return text;

    let cleaned = text;

    cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');
    cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1');
    cleaned = cleaned.replace(/\*(.+?)\*/g, '$1');
    cleaned = cleaned.replace(/`(.+?)`/g, '$1');
    cleaned = cleaned.replace(/^>\s+/gm, '');
    cleaned = cleaned.replace(/^[-*_]{3,}$/gm, '');
    cleaned = cleaned.replace(/\[(.+?)\]\(.+?\)/g, '$1');
    cleaned = cleaned.replace(/[ \t]+/g, ' ');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    return cleaned.trim();
}

function ThinkingDots() {
    return (
        <span className="inline-flex gap-1 items-center min-w-[20px]">
            <span className="w-1.5 h-1.5 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
            <span className="w-1.5 h-1.5 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="w-1.5 h-1.5 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
        </span>
    );
}

export default function AIChatbot({ isOpen, onClose }: AIChatbotProps) {
    const {
        question,
        setQuestion,
        isRobotThinking,
        isRobotResponding,
        setRobotThinking,
        setRobotResponding,
    } = useAI();
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            type: 'assistant',
            content: 'Hello! I\'m your AI Warehouse Assistant. How can I help you?',
            timestamp: new Date(),
            suggestions: [
                'How many parcels were received today?',
                'Show me low stock items',
            ]
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const [hasProcessedQuestion, setHasProcessedQuestion] = useState(false);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [isAtBottom, setIsAtBottom] = useState(true);

    // Check if user is at bottom
    const checkIfAtBottom = () => {
        if (messagesContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
            const atBottom = scrollHeight - scrollTop - clientHeight < 50;
            setIsAtBottom(atBottom);
            setShowScrollButton(!atBottom);
        }
    };

    const scrollToBottom = () => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTo({
                top: messagesContainerRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    };

    // Handle scroll events
    useEffect(() => {
        const container = messagesContainerRef.current;
        if (container) {
            container.addEventListener('scroll', checkIfAtBottom);
            return () => container.removeEventListener('scroll', checkIfAtBottom);
        }
    }, []);

    // Smart scroll
    useEffect(() => {
        if (isAtBottom && messages.length > 0) {
            scrollToBottom();
        }
    }, [messages]);

    // Lock body scroll
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.width = '100%';
            document.body.style.top = `-${window.scrollY}px`;
        } else {
            const scrollY = document.body.style.top;
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
            document.body.style.top = '';
            window.scrollTo(0, parseInt(scrollY || '0') * -1);
            setHasProcessedQuestion(false);
        }

        return () => {
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
            document.body.style.top = '';
        };
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 300);

            if (question && !hasProcessedQuestion && !isLoading) {
                setHasProcessedQuestion(true);
                setInput(question);
                setTimeout(() => {
                    handleSendMessage(question);
                }, 500);
            }
        } else {
            setHasProcessedQuestion(false);
        }
    }, [isOpen, question]);

    const handleSendMessage = async (customQuestion?: string) => {
        const trimmed = (customQuestion || input).trim();
        if (!trimmed || isLoading) return;

        if (question) {
            setQuestion('');
        }

        //  Set robot thinking state
        setRobotThinking(true);
        setRobotResponding(false);

        const userMsg: Message = {
            id: `user-${Date.now()}`,
            type: 'user',
            content: trimmed,
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);
        setSuggestions([]);

        const assistantMsgId = `assistant-${Date.now()}`;
        const assistantMsg: Message = {
            id: assistantMsgId,
            type: 'assistant',
            content: '',
            timestamp: new Date(),
            isThinking: true,
        };
        setMessages(prev => [...prev, assistantMsg]);

        try {
            const history = messages
                .filter(msg => msg.id !== 'welcome' && msg.id !== assistantMsgId)
                .map(msg => ({
                    role: msg.type === 'user' ? 'user' : 'assistant',
                    content: msg.content
                }));

            try {
                setIsStreaming(true);

                const response = await fetch('/ai/api/chat/stream', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        question: trimmed,
                        history: history,
                    }),
                });

                if (!response.ok) {
                    throw new Error(`API Error: ${response.status}`);
                }

                const reader = response.body?.getReader();
                const decoder = new TextDecoder();

                if (!reader) {
                    throw new Error('No reader available');
                }

                let fullContent = '';
                let hasReceivedChunk = false;
                let metaData: any = null;

                //  Robot is now responding
                setRobotThinking(false);
                setRobotResponding(true);

                setMessages(prev =>
                    prev.map(msg =>
                        msg.id === assistantMsgId
                            ? { ...msg, isThinking: false }
                            : msg
                    )
                );

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const jsonStr = line.slice(6);
                                if (jsonStr.trim() === '') continue;

                                const data = JSON.parse(jsonStr);

                                if (data.type === 'chunk') {
                                    hasReceivedChunk = true;
                                    if (data.full) {
                                        fullContent = data.full;
                                    } else if (data.content) {
                                        fullContent += data.content;
                                    }

                                    setMessages(prev =>
                                        prev.map(msg =>
                                            msg.id === assistantMsgId
                                                ? {
                                                    ...msg,
                                                    content: stripMarkdown(fullContent),
                                                    isThinking: false,
                                                }
                                                : msg
                                        )
                                    );
                                } else if (data.type === 'done') {
                                    metaData = data.meta || null;

                                    if (metaData?.suggestions) {
                                        setSuggestions(metaData.suggestions);
                                    }

                                    //  Robot done responding
                                    setRobotResponding(false);

                                    setMessages(prev =>
                                        prev.map(msg =>
                                            msg.id === assistantMsgId
                                                ? {
                                                    ...msg,
                                                    content: stripMarkdown(data.content || fullContent),
                                                    timestamp: new Date(),
                                                    isThinking: false,
                                                    suggestions: metaData?.suggestions || [],
                                                }
                                                : msg
                                        )
                                    );
                                } else if (data.type === 'error') {
                                    throw new Error(data.content || 'Stream error');
                                } else if (data.type === 'status') {
                                    setMessages(prev =>
                                        prev.map(msg =>
                                            msg.id === assistantMsgId
                                                ? {
                                                    ...msg,
                                                    content: `⏳ ${data.content}`,
                                                    isThinking: true,
                                                }
                                                : msg
                                        )
                                    );
                                }
                            } catch (parseError) {
                                console.error('Parse error:', parseError);
                            }
                        }
                    }
                }

                if (hasReceivedChunk) {
                    setIsStreaming(false);
                    setIsLoading(false);
                    setRobotResponding(false);
                    return;
                }

            } catch (streamError) {
                console.log('⚠️ Streaming failed:', streamError);
                setIsStreaming(false);
                setRobotResponding(false);
            }

            // Fallback to non-streaming
            setMessages(prev =>
                prev.map(msg =>
                    msg.id === assistantMsgId
                        ? { ...msg, isThinking: false }
                        : msg
                )
            );

            const response = await fetch('/ai/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question: trimmed,
                    history: history,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API Error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            if (data.meta?.suggestions) {
                setSuggestions(data.meta.suggestions);
            }

            //  Robot done responding
            setRobotResponding(false);

            setMessages(prev =>
                prev.map(msg =>
                    msg.id === assistantMsgId
                        ? {
                            ...msg,
                            content: stripMarkdown(data.response || 'No response received'),
                            timestamp: new Date(),
                            isThinking: false,
                            suggestions: data.meta?.suggestions || [],
                        }
                        : msg
                )
            );

        } catch (error) {
            const errorMessage = error instanceof Error
                ? error.message
                : 'Sorry, I encountered an error. Please try again.';

            //  Reset robot states on error
            setRobotThinking(false);
            setRobotResponding(false);

            setMessages(prev =>
                prev.map(msg =>
                    msg.id === assistantMsgId
                        ? {
                            ...msg,
                            content: `❌ ${errorMessage}`,
                            timestamp: new Date(),
                            isThinking: false,
                        }
                        : msg
                )
            );
        } finally {
            setIsLoading(false);
            setIsStreaming(false);
            setRobotThinking(false);
            setRobotResponding(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleSuggested = (question: string) => {
        setInput(question);
        setTimeout(() => handleSendMessage(), 100);
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const renderMessageContent = (msg: Message) => {
        if (msg.isThinking) {
            return (
                <div className="flex items-center gap-2">
                    <ThinkingDots />
                    <span className="text-xs text-slate-400">Thinking...</span>
                </div>
            );
        }

        if (msg.content.startsWith('⏳')) {
            return (
                <div className="flex items-center gap-2">
                    <span className="animate-pulse">⏳</span>
                    <span className="text-sm text-slate-500">{msg.content.replace('⏳', '').trim()}</span>
                </div>
            );
        }

        return (
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
        );
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-slate-900/40 dark:bg-slate-900/10 backdrop-blur-sm z-40 animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Chat Drawer */}
            <div className="fixed top-0 right-0 h-full w-full sm:w-[440px] 
                        bg-white/90 dark:bg-slate-900/75 backdrop-blur-2xl
                        z-50 animate-in slide-in-from-right duration-300 
                        flex flex-col font-sans 
                        shadow-2xl dark:shadow-[0_20px_25px_-5px_rgba(0,0,0,0.8),0_8px_10px_-6px_rgba(0,0,0,0.5)] 
                        border-l border-slate-200/80 dark:border-white/10">

                {/* Header with Robot */}
                <div className="bg-gradient-to-r from-pink-600 via-pink-500 to-rose-500 dark:from-slate-900/80 dark:via-slate-900/70 dark:to-pink-950/30 backdrop-blur-md px-5 py-4 flex items-center justify-between shrink-0 shadow-md dark:shadow-black/50 z-10 border-b border-transparent dark:border-white/10 transition-colors">
                    {/* Left: Assistant Status & Avatar */}
                    <div className="flex items-center gap-3.5">
                        <div className="relative flex items-center justify-center">
                            <RobotHeader
                                size={38}
                                isThinking={isRobotThinking}
                                isResponding={isRobotResponding}
                            />

                            {/* Live Indicator Badge */}
                            <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center">
                                <span
                                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isStreaming || isLoading
                                        ? "bg-amber-400 dark:bg-amber-300"
                                        : "bg-emerald-400 dark:bg-emerald-300"
                                        }`}
                                />
                                <span
                                    className={`relative inline-flex rounded-full h-2.5 w-2.5 border-2 border-pink-600 dark:border-slate-900 ${isStreaming || isLoading
                                        ? "bg-amber-400 dark:bg-amber-300 ring-2 ring-amber-500/20"
                                        : "bg-emerald-400 dark:bg-emerald-400 ring-2 ring-emerald-500/20"
                                        }`}
                                />
                            </span>
                        </div>

                        <div>
                            <h2 className="text-white dark:text-slate-100 font-semibold text-sm tracking-tight leading-snug">
                                AI Warehouse Assistant
                            </h2>
                            <p className="text-pink-100 dark:text-pink-300/80 text-[11px] font-medium tracking-wide opacity-90 flex items-center gap-1.5">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-pink-200 dark:bg-pink-400 animate-pulse shadow-xs shadow-pink-300" />
                                {isStreaming
                                    ? "Typing response..."
                                    : isLoading
                                        ? "Processing..."
                                        : "Online & Ready"}
                            </p>
                        </div>
                    </div>

                    {/* Right: Controls */}
                    <div className="flex items-center gap-1">
                        {messages.length > 1 && (
                            <button
                                onClick={() => {
                                    setMessages([messages[0]]);
                                    setSuggestions([]);
                                }}
                                className="text-white/80 dark:text-slate-400 hover:text-white dark:hover:text-pink-400 p-2 rounded-xl hover:bg-white/15 dark:hover:bg-pink-950/40 dark:hover:border-white/10 border border-transparent transition-all duration-200 active:scale-95 cursor-pointer"
                                title="Clear chat"
                                aria-label="Clear chat history"
                            >
                                <i className="fas fa-trash-alt text-xs" />
                            </button>
                        )}

                        <button
                            onClick={onClose}
                            className="text-white/80 dark:text-slate-400 hover:text-white dark:hover:text-pink-400 p-2 rounded-xl hover:bg-white/15 dark:hover:bg-pink-950/40 dark:hover:border-white/10 border border-transparent transition-all duration-200 active:scale-95 cursor-pointer"
                            title="Close drawer"
                            aria-label="Close assistant drawer"
                        >
                            <i className="fas fa-times text-base" />
                        </button>
                    </div>
                </div>

                {/* Messages Body */}
                <div className="relative flex-1 overflow-hidden bg-slate-50/40 dark:bg-transparent">
                    <div
                        ref={messagesContainerRef}
                        className="h-full overflow-y-auto p-5 space-y-5 scroll-smooth scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800"
                        onScroll={checkIfAtBottom}
                    >
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex items-start gap-3 ${msg.type === "user" ? "flex-row-reverse" : ""}`}
                            >
                                {/* Avatar handling */}
                                {msg.type === "user" ? (
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm bg-gradient-to-tr from-pink-600 to-rose-500 text-white">
                                        <i className="fas fa-user text-xs" />
                                    </div>
                                ) : (
                                    <RobotAvatar
                                        size={32}
                                        isThinking={msg.isThinking}
                                        isResponding={!msg.isThinking && msg.content?.length > 0}
                                        className="shrink-0"
                                    />
                                )}

                                <div
                                    className={`max-w-[82%] space-y-1.5 ${msg.type === "user" ? "items-end" : "items-start"
                                        }`}
                                >
                                    {/* Message Bubble */}
                                    <div
                                        className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm transition-colors ${msg.type === "user"
                                            ? "bg-gradient-to-tr from-pink-600 to-rose-500 text-white rounded-tr-none font-normal dark:shadow-pink-950/20"
                                            : "bg-white/90 dark:bg-slate-800/70 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-white/10 rounded-tl-none font-normal backdrop-blur-md"
                                            }`}
                                    >
                                        {renderMessageContent(msg)}
                                    </div>

                                    {/* Timestamp */}
                                    <div
                                        className={`flex items-center gap-2 px-1 ${msg.type === "user" ? "justify-end" : "justify-start"
                                            }`}
                                    >
                                        {msg.content && !msg.isThinking && (
                                            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                                                {formatTime(msg.timestamp)}
                                            </span>
                                        )}
                                    </div>

                                    {/* Suggestions */}
                                    {msg.suggestions && msg.suggestions.length > 0 && msg.type === "assistant" && (
                                        <div className="pt-2 space-y-1.5">
                                            <span className="text-[11px] font-semibold text-pink-600/90 dark:text-pink-400 flex items-center gap-1">
                                                <i className="fas fa-lightbulb text-amber-500 dark:text-amber-400 text-[10px]" />{" "}
                                                Follow-up ideas
                                            </span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {msg.suggestions.slice(0, 3).map((suggestion) => (
                                                    <button
                                                        key={suggestion}
                                                        onClick={() => {
                                                            setInput(suggestion);
                                                            setTimeout(() => handleSendMessage(), 100);
                                                        }}
                                                        className="text-xs font-medium bg-white/90 dark:bg-slate-800/60 hover:bg-pink-50 dark:hover:bg-pink-950/40 hover:border-pink-300 dark:hover:border-pink-500/40 border border-pink-100 dark:border-white/10 text-pink-700 dark:text-pink-300 px-3 py-1.5 rounded-xl transition-all shadow-xs dark:shadow-black/20 active:scale-95 text-left cursor-pointer backdrop-blur-sm"
                                                    >
                                                        {suggestion}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Loading Indicator */}
                        {isLoading && messages[messages.length - 1]?.content && !isStreaming && (
                            <div className="flex items-center gap-2 text-xs font-medium text-pink-600 dark:text-pink-400 bg-pink-50/80 dark:bg-pink-950/50 border border-pink-100 dark:border-pink-500/30 px-3 py-1.5 rounded-full w-fit animate-pulse shadow-2xs backdrop-blur-sm">
                                <i className="fas fa-circle-notch fa-spin" />
                                <span>Thinking...</span>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Floating Scroll-to-Bottom Button */}
                    {showScrollButton && (
                        <button
                            onClick={scrollToBottom}
                            className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl hover:bg-pink-50 dark:hover:bg-pink-950/40 text-pink-600 dark:text-pink-400 border border-pink-200/80 dark:border-white/10 dark:hover:border-pink-500/30 shadow-lg dark:shadow-black/50 rounded-full p-2.5 transition-all duration-200 hover:scale-105 active:scale-95 z-10 cursor-pointer"
                            aria-label="Scroll to bottom"
                        >
                            <i className="fas fa-arrow-down text-xs" />
                            <span className="sr-only">Scroll to bottom</span>
                        </button>
                    )}
                </div>

                {/* Quick Prompts */}
                {messages.length < 3 && (
                    <div className="px-5 py-3.5 border-t border-slate-100/80 dark:border-white/10 bg-white/80 dark:bg-slate-900/60 backdrop-blur-md shrink-0 transition-colors">
                        {/* Header */}
                        <p className="text-[11px] font-bold text-pink-600 dark:text-pink-400 mb-2.5 flex items-center gap-1.5 uppercase tracking-wider">
                            <i className="fas fa-sparkles text-pink-500 dark:text-pink-400 text-[11px] dark:drop-shadow-[0_0_6px_rgba(244,63,94,0.4)]" />
                            <span>Quick Prompts</span>
                        </p>

                        {/* Prompt Buttons Container */}
                        <div className="flex flex-wrap gap-1.5">
                            {SUGGESTED_QUESTIONS.map((q) => (
                                <button
                                    key={q}
                                    onClick={() => handleSuggested(q)}
                                    disabled={isLoading}
                                    className="text-xs font-medium bg-slate-50/80 dark:bg-slate-800/50 hover:bg-pink-50/80 dark:hover:bg-pink-950/40 border border-slate-200/80 dark:border-white/10 hover:border-pink-300 dark:hover:border-pink-500/40 text-slate-700 dark:text-slate-200 hover:text-pink-700 dark:hover:text-pink-300 px-3 py-1.5 rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none active:scale-95 cursor-pointer focus:outline-none focus:ring-2 focus:ring-pink-500/30 shadow-2xs dark:shadow-black/20 backdrop-blur-sm"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Input Area */}
                <div className="p-4 border-t border-slate-100/80 dark:border-white/10 bg-white/80 dark:bg-slate-900/65 backdrop-blur-xl shrink-0 shadow-lg dark:shadow-black/50 transition-all">
                    <div className="relative flex items-center">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask about inventory, stock, or orders..."
                            className="w-full bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-white/10 rounded-2xl pl-4 pr-12 py-3 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800/60 focus:border-pink-500 dark:focus:border-pink-500/80 focus:ring-4 focus:ring-pink-500/10 dark:focus:ring-pink-500/20 transition-all duration-200 backdrop-blur-sm"
                            disabled={isLoading}
                        />

                        <button
                            onClick={() => handleSendMessage()}
                            disabled={!input.trim() || isLoading}
                            aria-label="Send message"
                            className="absolute right-1.5 w-9 h-9 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white disabled:opacity-30 disabled:hover:from-pink-500 disabled:hover:to-rose-500 disabled:cursor-not-allowed shadow-md shadow-pink-500/25 dark:shadow-pink-500/30 flex items-center justify-center transition-all duration-200 active:scale-95 cursor-pointer"
                        >
                            <i className={`fas ${isLoading ? 'fa-spinner fa-spin' : 'fa-arrow-up'} text-xs`} />
                        </button>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between px-1">
                        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                            {isLoading ? (
                                <>
                                    <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-ping" />
                                    <span>Processing request...</span>
                                </>
                            ) : (
                                <span>Press <kbd className="px-1 py-0.5 rounded text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10 font-mono">Enter</kbd> to send</span>
                            )}
                        </span>

                        <span className="text-[10px] font-semibold text-pink-500/90 dark:text-pink-400/90 uppercase tracking-wider flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-pink-500 dark:bg-pink-400" />
                            Warehouse AI
                        </span>
                    </div>
                </div>
            </div>
        </>
    );
}