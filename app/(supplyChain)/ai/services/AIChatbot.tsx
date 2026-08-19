// app/components/ai/AIChatbot.tsx

"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAI } from "./AIContext";
//  Import robot components
import { RobotAvatar, RobotHeader } from "../components";
import { motion } from "framer-motion";

interface PendingRequestItem {
    name: string;
    quantity: number;
    unit_price?: number;
    total?: number;
}

interface PendingPRData {
    id: string;
    request_number: string;
    type?: string;
    description?: string;
    requested_by: string;
    department?: string;
    supplier_id: string;
    supplier_name: string;
    supplier_email?: string;
    amount: number;
    priority: string;
    date: string;
    status: string;
    items: PendingRequestItem[];
    reason?: string;
}

interface Message {
    id: string;
    type: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    isThinking?: boolean;
    suggestions?: string[];
    pendingRequests?: PendingPRData[];
    createdPOs?: any[];
}

interface AIChatbotProps {
    isOpen: boolean;
    onClose: () => void;
}

const STORAGE_KEY = 'airship_supply_chain_chat_history';

const SUGGESTED_QUESTIONS = [
    "Create purchase order",
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

    const [messages, setMessages] = useState<Message[]>(() => {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem(STORAGE_KEY);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    return parsed.map((m: any) => ({
                        ...m,
                        timestamp: new Date(m.timestamp)
                    }));
                }
            } catch (e) {
                console.error("Failed to load chat from localStorage:", e);
            }
        }
        return [
            {
                id: 'welcome',
                type: 'assistant',
                content: 'Hello! I\'m your AI Warehouse Assistant. How can I help you?',
                timestamp: new Date(),
                suggestions: [
                    'Create purchase order',
                    'How many parcels were received today?',
                    'Show me low stock items',
                ]
            }
        ];
    });

    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [selectedPRIds, setSelectedPRIds] = useState<Set<string>>(new Set());
    const [isCreatingPO, setIsCreatingPO] = useState(false);
    const [actionFeedback, setActionFeedback] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const [hasProcessedQuestion, setHasProcessedQuestion] = useState(false);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [isAtBottom, setIsAtBottom] = useState(true);

    // Save messages to localStorage on changes
    useEffect(() => {
        if (typeof window !== 'undefined' && messages.length > 0) {
            try {
                const cleanMessages = messages
                    .filter(m => !m.isThinking && !m.content.startsWith('⏳'))
                    .slice(-40);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanMessages));
            } catch (e) {
                console.error("Failed to save chat to localStorage:", e);
            }
        }
    }, [messages]);

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
                const currentRole = typeof window !== 'undefined' ? (localStorage.getItem('user_role') || 'User') : 'User';

                const response = await fetch('/ai/api/chat/stream', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        question: trimmed,
                        history: history,
                        role: currentRole,
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

                let buffer = '';
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n\n');
                    // Keep the last partial line (if any) in the buffer
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (trimmedLine.startsWith('data: ')) {
                            try {
                                const jsonStr = trimmedLine.slice(6);
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

                                    // Extract pending PR data if returned by action
                                    let prData: PendingPRData[] | undefined = undefined;
                                    if (metaData?.actionResults?.get_pending_purchase_requests?.requests) {
                                        prData = metaData.actionResults.get_pending_purchase_requests.requests;
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
                                                    pendingRequests: prData,
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

            const currentRole = typeof window !== 'undefined' ? (localStorage.getItem('user_role') || 'User') : 'User';

            const response = await fetch('/ai/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question: trimmed,
                    history: history,
                    role: currentRole,
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

            let fallbackPRData: PendingPRData[] | undefined = undefined;
            if (data.meta?.actionResults?.get_pending_purchase_requests?.requests) {
                fallbackPRData = data.meta.actionResults.get_pending_purchase_requests.requests;
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
                            pendingRequests: fallbackPRData,
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

    const handleBatchCreatePOs = async (messageId: string, sendEmail: boolean) => {
        if (selectedPRIds.size === 0) {
            setActionFeedback("Please select at least one purchase request.");
            setTimeout(() => setActionFeedback(null), 3000);
            return;
        }

        setIsCreatingPO(true);
        setActionFeedback(sendEmail ? "Creating Purchase Orders and sending emails..." : "Creating Draft Purchase Orders...");

        try {
            const currentRole = typeof window !== 'undefined' ? (localStorage.getItem('user_role') || 'Manager') : 'Manager';
            const currentUserName = typeof window !== 'undefined' ? (localStorage.getItem('user_name') || 'Procurement Team') : 'Procurement Team';

            const res = await fetch('/ai/api/create-pos-from-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    request_ids: Array.from(selectedPRIds),
                    send_email: sendEmail,
                    role: currentRole,
                    user_name: currentUserName,
                })
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to create Purchase Orders');
            }

            // Update the message in state
            setMessages(prev => prev.map(m => {
                if (m.id === messageId && m.pendingRequests) {
                    const remaining = m.pendingRequests.filter(pr => !selectedPRIds.has(pr.id));
                    return {
                        ...m,
                        pendingRequests: remaining.length > 0 ? remaining : undefined,
                        createdPOs: [...(m.createdPOs || []), ...(data.createdPOs || [])],
                    };
                }
                return m;
            }));

            // Add an assistant confirmation message
            const poList = (data.createdPOs || []).map((po: any) => `• **${po.po_number}** for ${po.supplier_name} (₱${(po.total_amount || 0).toLocaleString()}) - Status: ${po.status}`).join('\n');
            const emailSummary = sendEmail ? '\n📧 Emails with confirmation links have been dispatched to suppliers.' : '\n📝 Orders are saved as **Drafts**. You can review them in the Purchase Orders page and choose to send whenever you are ready.';

            const confirmationMsg: Message = {
                id: `assistant-${Date.now()}`,
                type: 'assistant',
                content: `Successfully generated ${data.createdPOs?.length || 0} Purchase Order(s):\n\n${poList}${emailSummary}`,
                timestamp: new Date(),
                createdPOs: data.createdPOs || [],
                suggestions: [
                    'Show all purchase orders',
                    'What is our total procurement spend?',
                ]
            };

            setMessages(prev => [...prev, confirmationMsg]);
            setSelectedPRIds(new Set());
            setActionFeedback(null);
        } catch (err: any) {
            console.error("Error creating POs from chat:", err);
            setActionFeedback(`Error: ${err.message || 'Failed'}`);
            setTimeout(() => setActionFeedback(null), 5000);
        } finally {
            setIsCreatingPO(false);
        }
    };

    const renderPendingRequestsWidget = (msg: Message) => {
        if (!msg.pendingRequests || msg.pendingRequests.length === 0) return null;

        const currentRole = (typeof window !== 'undefined' ? (localStorage.getItem('user_role') || '') : '').toLowerCase();
        const canManagePOs = ['admin', 'manager', 'executive'].includes(currentRole);

        const allSelected = msg.pendingRequests.length > 0 && msg.pendingRequests.every(pr => selectedPRIds.has(pr.id));

        return (
            <div className="mt-3.5 pt-3 border-t border-slate-200/80 dark:border-white/10 space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                            Purchase Requests ({msg.pendingRequests.length})
                        </span>
                    </div>

                    {canManagePOs && (
                        <button
                            type="button"
                            onClick={() => {
                                if (allSelected) {
                                    setSelectedPRIds(new Set());
                                } else {
                                    setSelectedPRIds(new Set(msg.pendingRequests?.map(pr => pr.id) || []));
                                }
                            }}
                            className="text-[11px] font-semibold text-pink-600 dark:text-pink-400 hover:underline cursor-pointer"
                        >
                            {allSelected ? "Deselect All" : "Select All"}
                        </button>
                    )}
                </div>

                {/* PR Cards List */}
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
                    {msg.pendingRequests.map(pr => {
                        const isSelected = selectedPRIds.has(pr.id);
                        return (
                            <div
                                key={pr.id}
                                onClick={() => {
                                    if (!canManagePOs) return;
                                    const next = new Set(selectedPRIds);
                                    if (next.has(pr.id)) next.delete(pr.id);
                                    else next.add(pr.id);
                                    setSelectedPRIds(next);
                                }}
                                className={`p-2.5 rounded-xl border transition-all ${canManagePOs ? 'cursor-pointer' : ''} ${isSelected
                                    ? 'bg-pink-50/80 dark:bg-pink-950/40 border-pink-300 dark:border-pink-500/50 shadow-xs'
                                    : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-white/10 hover:border-pink-200 dark:hover:border-pink-500/30'
                                    }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-start gap-2 min-w-0">
                                        {canManagePOs && (
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => { }}
                                                className="mt-0.5 rounded border-slate-300 text-pink-600 focus:ring-pink-500 shrink-0 cursor-pointer"
                                            />
                                        )}
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                                    {pr.request_number}
                                                </span>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                                    {pr.priority}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                                Supplier: <strong className="text-slate-700 dark:text-slate-200">{pr.supplier_name}</strong>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className="text-xs font-bold text-pink-600 dark:text-pink-400">
                                            ₱{(pr.amount || 0).toLocaleString()}
                                        </span>
                                        <p className="text-[10px] text-slate-400">
                                            {pr.items?.length || 0} item(s)
                                        </p>
                                    </div>
                                </div>

                                {pr.items && pr.items.length > 0 && (
                                    <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-white/5 flex flex-wrap gap-1">
                                        {pr.items.slice(0, 3).map((it, idx) => (
                                            <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400">
                                                {it.name} (x{it.quantity})
                                            </span>
                                        ))}
                                        {pr.items.length > 3 && (
                                            <span className="text-[10px] text-slate-400">+{pr.items.length - 3} more</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Batch Action Buttons */}
                {canManagePOs && (
                    <div className="space-y-2 pt-1">
                        {actionFeedback && (
                            <p className="text-xs text-pink-600 dark:text-pink-400 font-medium animate-pulse text-center">
                                {actionFeedback}
                            </p>
                        )}
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                disabled={selectedPRIds.size === 0 || isCreatingPO}
                                onClick={() => handleBatchCreatePOs(msg.id, false)}
                                className="flex-1 py-2 px-3 text-xs font-semibold rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xs active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <i className="fas fa-file-signature text-[11px]" />
                                <span className="text-xs text-slate-900 dark:text-white">Create as Draft ({selectedPRIds.size})</span>
                            </button>

                            <button
                                type="button"
                                disabled={selectedPRIds.size === 0 || isCreatingPO}
                                onClick={() => handleBatchCreatePOs(msg.id, true)}
                                className="flex-1 py-2 px-3 text-xs font-semibold rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 text-white hover:from-pink-500 hover:to-rose-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xs active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <i className="fas fa-paper-plane text-[11px]" />
                                <span>Create & Send via Gmail</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderCreatedPOsWidget = (msg: Message) => {
        if (!msg.createdPOs || msg.createdPOs.length === 0) return null;

        return (
            <div className="mt-3.5 pt-3 border-t border-slate-200/80 dark:border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                        <i className="fas fa-check-circle text-emerald-500" />
                        Generated Purchase Orders ({msg.createdPOs.length})
                    </span>
                    <Link
                        href={`/purchase-orders?search=${encodeURIComponent(msg.createdPOs[0]?.po_number || '')}`}
                        onClick={onClose}
                        className="text-[11px] font-semibold text-pink-600 dark:text-pink-400 hover:underline flex items-center gap-1"
                    >
                        <span>View in PO Page</span>
                        <i className="fas fa-external-link-alt text-[10px]" />
                    </Link>
                </div>

                <div className="space-y-2">
                    {msg.createdPOs.map((po: any, idx: number) => (
                        <div
                            key={po.id || idx}
                            className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 flex items-center justify-between gap-3"
                        >
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                                        {po.po_number}
                                    </span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${po.status === 'Sent'
                                        ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                                        : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                                        }`}>
                                        {po.status}
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                    {po.supplier_name} • ₱{(po.total_amount || 0).toLocaleString()}
                                </p>
                            </div>

                            <Link
                                href={`/purchase-orders?search=${encodeURIComponent(po.po_number)}`}
                                onClick={onClose}
                                className="shrink-0 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-pink-500/10 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400 hover:bg-pink-500 hover:text-white dark:hover:bg-pink-500 dark:hover:text-white transition-all flex items-center gap-1 cursor-pointer"
                            >
                                <span>Filter PO</span>
                                <i className="fas fa-arrow-right text-[10px]" />
                            </Link>
                        </div>
                    ))}
                </div>
            </div>
        );
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
            <div>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                {renderPendingRequestsWidget(msg)}
                {renderCreatedPOsWidget(msg)}
            </div>
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
            <div 
                data-lenis-prevent
                className="fixed top-0 right-0 h-full w-full sm:w-[440px] 
                        bg-white/90 dark:bg-slate-900/75 backdrop-blur-2xl
                        z-50 animate-in slide-in-from-right duration-300 
                        flex flex-col font-sans overscroll-contain
                        shadow-2xl dark:shadow-[0_20px_25px_-5px_rgba(0,0,0,0.8),0_8px_10px_-6px_rgba(0,0,0,0.5)] 
                        border-l border-slate-200/80 dark:border-white/10"
            >

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
                                    const welcomeMsg: Message = {
                                        id: 'welcome',
                                        type: 'assistant',
                                        content: 'Hello! I\'m your AI Warehouse Assistant. How can I help you?',
                                        timestamp: new Date(),
                                        suggestions: [
                                            'Create purchase order',
                                            'How many parcels were received today?',
                                            'Show me low stock items',
                                        ]
                                    };
                                    setMessages([welcomeMsg]);
                                    setSuggestions([]);
                                    if (typeof window !== 'undefined') {
                                        localStorage.removeItem(STORAGE_KEY);
                                    }
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
                        data-lenis-prevent
                        className="h-full overflow-y-auto overscroll-contain p-5 space-y-5 scroll-smooth scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800"
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