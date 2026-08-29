// app/components/ai/AIChatbot.tsx

"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAI } from "./AIContext";
//  Import robot components
import { RobotAvatar, RobotHeader } from "../components";
import { motion } from "framer-motion";
import AppButton from "@/app/(supplyChain)/components/ui/AppButton";
import { StatusBadge } from "@/app/(supplyChain)/components/ui/StatusBadge";

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

export interface LowStockInteractiveItem {
    id: number;
    item_code: string;
    item_name: string;
    category: string;
    unit: string;
    current_stock: number;
    minimum_stock: number;
    storage_location?: string | null;
    supplier?: string | null;
    supplier_id?: string | number | null;
    supplier_name?: string | null;
    supplier_email?: string | null;
    supplier_contact?: string | null;
    purchase_price?: number;
    suggested_quantity: number;
    stock_type: 'out_of_stock' | 'low_stock';
    status: string;
}

export interface AttachedFile {
    name: string;
    type: string;
    size: number;
    dataUrl: string;
}

export interface MatchedDocument {
    id: string;
    title: string;
    file_name: string;
    category: string;
    document_type: string;
    supplier: string;
    po_number: string;
    parcel_batch?: string | null;
    uploaded_by: string;
    created_at: string;
    storage_path?: string;
    is_gallery: boolean;
    view_link: string;
}

interface Message {
    id: string;
    type: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    isThinking?: boolean;
    attachment?: AttachedFile;
    matchedDocument?: MatchedDocument;
    isOutOfScope?: boolean;
    suggestions?: string[];
    pendingRequests?: PendingPRData[];
    createdPOs?: any[];
    lowStockItems?: LowStockInteractiveItem[];
    createdPRs?: any[];
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
        openChat,
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
    const [selectedLowStockIds, setSelectedLowStockIds] = useState<Set<number>>(new Set());
    const [lowStockQuantities, setLowStockQuantities] = useState<Record<number, number>>({});
    const [lowStockFilter, setLowStockFilter] = useState<'all' | 'out_of_stock' | 'low_stock'>('all');
    const [isCreatingPR, setIsCreatingPR] = useState(false);
    const [actionFeedback, setActionFeedback] = useState<string | null>(null);

    const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            setActionFeedback("File size must be under 10MB");
            setTimeout(() => setActionFeedback(null), 4000);
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            setAttachedFile({
                name: file.name,
                type: file.type || "application/octet-stream",
                size: file.size,
                dataUrl,
            });
        };
        reader.readAsDataURL(file);
        e.target.value = "";
    };

    const handleRemoveAttachment = () => {
        setAttachedFile(null);
    };

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const [hasProcessedQuestion, setHasProcessedQuestion] = useState(false);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [isAtBottom, setIsAtBottom] = useState(true);

    // Save messages to localStorage on changes (sanitizing large dataUrls to stay within 5MB quota)
    useEffect(() => {
        if (typeof window !== 'undefined' && messages.length > 0) {
            try {
                const cleanMessages = messages
                    .filter(m => !m.isThinking && !m.content.startsWith('⏳'))
                    .slice(-30)
                    .map(m => {
                        if (m.attachment) {
                            return {
                                ...m,
                                attachment: {
                                    name: m.attachment.name,
                                    type: m.attachment.type,
                                    size: m.attachment.size,
                                    dataUrl: '', // Omit heavy base64 payload to prevent QuotaExceededError
                                }
                            };
                        }
                        return m;
                    });
                localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanMessages));
            } catch (e) {
                console.warn("Storage quota exceeded, clearing older cache:", e);
                try {
                    // Fallback: store only the last 5 basic text messages
                    const minimalMessages = messages
                        .filter(m => !m.isThinking && !m.content.startsWith('⏳'))
                        .slice(-5)
                        .map(m => ({ id: m.id, type: m.type, content: m.content, timestamp: m.timestamp }));
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(minimalMessages));
                } catch (fallbackErr) {
                    // Ignore if browser storage is completely full
                }
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
            // Immediate instant scroll to bottom to show the latest chat
            if (messagesContainerRef.current) {
                messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
            }

            const t1 = setTimeout(() => {
                if (messagesContainerRef.current) {
                    messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
                }
                messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
            }, 60);

            const t2 = setTimeout(() => {
                if (messagesContainerRef.current) {
                    messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
                }
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                inputRef.current?.focus();
            }, 300);

            if (question && !hasProcessedQuestion && !isLoading) {
                setHasProcessedQuestion(true);
                setInput(question);
                setTimeout(() => {
                    handleSendMessage(question);
                }, 500);
            }

            return () => {
                clearTimeout(t1);
                clearTimeout(t2);
            };
        } else {
            setHasProcessedQuestion(false);
        }
    }, [isOpen, question]);

    const handleSendMessage = async (customQuestion?: string) => {
        const currentFile = attachedFile;
        setAttachedFile(null);

        const trimmed = (customQuestion || input).trim();
        const userPrompt = trimmed || (currentFile ? `Analyze this file: ${currentFile.name}` : "");
        if (!userPrompt && !currentFile) return;
        if (isLoading) return;

        if (question) {
            setQuestion('');
        }

        // Set robot thinking state
        setRobotThinking(true);
        setRobotResponding(false);

        const userMsg: Message = {
            id: `user-${Date.now()}`,
            type: 'user',
            content: userPrompt,
            timestamp: new Date(),
            attachment: currentFile || undefined,
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

        // If an attachment is present, route to multimodal document analysis API
        if (currentFile) {
            try {
                const currentRole = typeof window !== 'undefined' ? (localStorage.getItem('user_role') || 'User') : 'User';
                const currentUserName = typeof window !== 'undefined' ? (localStorage.getItem('user_name') || 'User') : 'User';
                const currentUserEmail = typeof window !== 'undefined' ? (localStorage.getItem('user_email') || '') : '';

                const docRes = await fetch('/ai/api/analyze-document', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        file: {
                            name: currentFile.name,
                            type: currentFile.type,
                            size: currentFile.size,
                            base64: currentFile.dataUrl,
                        },
                        userPrompt: trimmed,
                        role: currentRole,
                        userName: currentUserName,
                        userEmail: currentUserEmail,
                    })
                });

                const docData = await docRes.json();

                if (docRes.status === 429 || docData.rateLimited) {
                    const retrySecs = docData.retryAfter || 60;
                    setMessages(prev => prev.map(m => {
                        if (m.id === assistantMsgId) {
                            return {
                                ...m,
                                content: `⏳ **Rate Limit Reached**\n\nTo ensure fair usage and prevent spamming, document & picture analysis is limited to **3 requests per 5 minutes**.\n\nPlease wait **${retrySecs} seconds** before submitting another document.`,
                                isThinking: false,
                                suggestions: ['Show me low stock items', 'What is the current inventory status?']
                            };
                        }
                        return m;
                    }));
                    setRobotThinking(false);
                    setIsLoading(false);
                    return;
                }

                if (!docRes.ok || !docData.success) {
                    throw new Error(docData.error || 'Failed to analyze document.');
                }

                setMessages(prev => prev.map(m => {
                    if (m.id === assistantMsgId) {
                        return {
                            ...m,
                            content: docData.response || 'Document analysis completed.',
                            isThinking: false,
                            matchedDocument: docData.matchedDocument || undefined,
                            isOutOfScope: docData.isOutOfScope || false,
                            suggestions: docData.isOutOfScope
                                ? ['Show me low stock items', 'Check current inventory status', 'View recent purchase orders']
                                : [
                                    docData.matchedDocument ? (docData.matchedDocument.is_gallery ? 'View in Gallery' : 'View in Documents') : 'View documents repository',
                                    'Check low stock items',
                                    'Create purchase request'
                                ]
                        };
                    }
                    return m;
                }));

                setRobotThinking(false);
                setIsLoading(false);
                return;

            } catch (docErr: any) {
                console.error("Document analysis error:", docErr);
                setMessages(prev => prev.map(m => {
                    if (m.id === assistantMsgId) {
                        return {
                            ...m,
                            content: `❌ **Analysis Error:** ${docErr.message || 'Failed to process document.'}\n\nPlease ensure the uploaded file is a valid image or PDF document and try again.`,
                            isThinking: false,
                        };
                    }
                    return m;
                }));
                setRobotThinking(false);
                setIsLoading(false);
                return;
            }
        }

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

                                    // Extract low stock / out of stock data if returned by action
                                    let lowStockData: LowStockInteractiveItem[] | undefined = undefined;
                                    const rawLowStock = metaData?.actionResults?.get_low_stock || metaData?.actionResults?.get_out_of_stock || metaData?.actionResults?.get_low_stock_items;
                                    if (Array.isArray(rawLowStock) && rawLowStock.length > 0) {
                                        lowStockData = rawLowStock;
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
                                                    lowStockItems: lowStockData,
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

            let fallbackLowStockData: LowStockInteractiveItem[] | undefined = undefined;
            const fallbackRawLowStock = data.meta?.actionResults?.get_low_stock || data.meta?.actionResults?.get_out_of_stock || data.meta?.actionResults?.get_low_stock_items;
            if (Array.isArray(fallbackRawLowStock) && fallbackRawLowStock.length > 0) {
                fallbackLowStockData = fallbackRawLowStock;
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
                            lowStockItems: fallbackLowStockData,
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

    const handleBatchCreatePRs = async (messageId: string) => {
        if (selectedLowStockIds.size === 0) {
            setActionFeedback("Please select at least one item to replenish.");
            setTimeout(() => setActionFeedback(null), 3000);
            return;
        }

        setIsCreatingPR(true);
        setActionFeedback("Creating Purchase Requests and notifying Admin & Executive...");

        try {
            const targetMessage = messages.find(m => m.id === messageId);
            const lowStockItems = targetMessage?.lowStockItems || [];
            const selectedItems = lowStockItems
                .filter(item => selectedLowStockIds.has(item.id))
                .map(item => ({
                    ...item,
                    quantity: lowStockQuantities[item.id] || item.suggested_quantity || 10,
                }));

            const currentRole = typeof window !== 'undefined' ? (localStorage.getItem('user_role') || 'Manager') : 'Manager';
            const currentUserName = typeof window !== 'undefined' ? (localStorage.getItem('user_name') || 'Inventory Officer') : 'Inventory Officer';
            const currentUserEmail = typeof window !== 'undefined' ? (localStorage.getItem('user_email') || '') : '';

            const res = await fetch('/ai/api/create-prs-from-low-stock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: selectedItems,
                    role: currentRole,
                    user_name: currentUserName,
                    user_email: currentUserEmail,
                })
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to create Purchase Requests');
            }

            // Update message in state
            setMessages(prev => prev.map(m => {
                if (m.id === messageId && m.lowStockItems) {
                    const remaining = m.lowStockItems.filter(it => !selectedLowStockIds.has(it.id));
                    return {
                        ...m,
                        lowStockItems: remaining.length > 0 ? remaining : undefined,
                        createdPRs: [...(m.createdPRs || []), ...(data.createdPRs || [])],
                    };
                }
                return m;
            }));

            const prList = (data.createdPRs || []).map((pr: any) => `• **${pr.request_number}** for ${pr.supplier_name || 'Supplier'} - ${pr.description || pr.items?.[0]?.name || 'Item'} (₱${(pr.amount || 0).toLocaleString()})`).join('\n');
            const notifSummary = '\n\n🔔 In-app notifications have been dispatched to **Admin** and **Executive** dashboards for review and approval.';

            const confirmationMsg: Message = {
                id: `assistant-${Date.now()}`,
                type: 'assistant',
                content: `Successfully generated ${data.createdPRs?.length || 0} Purchase Request(s):\n\n${prList}${notifSummary}`,
                timestamp: new Date(),
                createdPRs: data.createdPRs || [],
                suggestions: [
                    'Show pending purchase requests',
                    'Check current inventory levels',
                ]
            };

            setMessages(prev => [...prev, confirmationMsg]);
            setSelectedLowStockIds(new Set());
            setActionFeedback(null);
        } catch (err: any) {
            console.error("Error creating PRs from chat:", err);
            setActionFeedback(`Error: ${err.message || 'Failed'}`);
            setTimeout(() => setActionFeedback(null), 5000);
        } finally {
            setIsCreatingPR(false);
        }
    };

    const renderPendingRequestsWidget = (msg: Message) => {
        if (!msg.pendingRequests || msg.pendingRequests.length === 0) return null;

        const currentRole = (typeof window !== 'undefined' ? (localStorage.getItem('user_role') || '') : '').toLowerCase();
        const canManagePOs = ['admin', 'manager', 'executive', 'employee', 'user'].includes(currentRole);

        const allSelected = msg.pendingRequests.length > 0 && msg.pendingRequests.every(pr => selectedPRIds.has(pr.id));

        return (
            <div className="mt-3.5 pt-3 border-t border-slate-200/90 dark:border-[#353746] space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse shrink-0" />
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
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
                            className="text-[11px] font-semibold text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 transition-colors cursor-pointer"
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
                                className={`p-3 rounded-2xl border transition-all ${canManagePOs ? 'cursor-pointer' : ''} ${isSelected
                                    ? 'bg-[#ffe6f0] dark:bg-[#341427] border-pink-300 dark:border-[#67224c] shadow-[0_2px_8px_rgba(244,63,94,0.15),inset_0_1px_0_#ffffff] dark:shadow-[0_2px_8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)]'
                                    : 'bg-white dark:bg-slate-900/60 border-slate-200/90 dark:border-[#353746] shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0_#ffffff] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-pink-200 dark:hover:border-pink-500/30'
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
                                                <StatusBadge tone="neutral" size="xs">
                                                    {pr.priority}
                                                </StatusBadge>
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
                                            <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
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
                            <AppButton
                                type="button"
                                variant="neutral"
                                size="sm"
                                pill
                                disabled={selectedPRIds.size === 0 || isCreatingPO}
                                onClick={() => handleBatchCreatePOs(msg.id, false)}
                                className="flex-1 justify-center text-xs"
                            >
                                <i className="fas fa-file-signature text-[11px] shrink-0" />
                                <span>Create as Draft ({selectedPRIds.size})</span>
                            </AppButton>

                            <AppButton
                                type="button"
                                variant="pink"
                                size="sm"
                                pill
                                disabled={selectedPRIds.size === 0 || isCreatingPO}
                                onClick={() => handleBatchCreatePOs(msg.id, true)}
                                className="flex-1 justify-center text-xs"
                            >
                                <i className="fas fa-paper-plane text-[11px] shrink-0" />
                                <span>Create & Send via Gmail</span>
                            </AppButton>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderLowStockWidget = (msg: Message) => {
        if (!msg.lowStockItems || msg.lowStockItems.length === 0) return null;

        const currentRole = (typeof window !== 'undefined' ? (localStorage.getItem('user_role') || '') : '').toLowerCase();
        const canManagePRs = ['admin', 'executive', 'manager'].includes(currentRole);

        const outOfStockCount = msg.lowStockItems.filter(it => it.current_stock === 0).length;
        const lowStockCount = msg.lowStockItems.filter(it => it.current_stock > 0).length;

        const filteredItems = msg.lowStockItems.filter(it => {
            if (lowStockFilter === 'out_of_stock') return it.current_stock === 0;
            if (lowStockFilter === 'low_stock') return it.current_stock > 0;
            return true;
        });

        const allFilteredSelected = filteredItems.length > 0 && filteredItems.every(it => selectedLowStockIds.has(it.id));

        return (
            <div className="mt-3.5 pt-3 border-t border-slate-200/90 dark:border-[#353746] space-y-3">
                {/* Header & Quick Filter Pills */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                Stock Replenishment Items ({msg.lowStockItems.length})
                            </span>
                        </div>

                        {canManagePRs && (
                            <button
                                type="button"
                                onClick={() => {
                                    if (allFilteredSelected) {
                                        const next = new Set(selectedLowStockIds);
                                        filteredItems.forEach(it => next.delete(it.id));
                                        setSelectedLowStockIds(next);
                                    } else {
                                        const next = new Set(selectedLowStockIds);
                                        filteredItems.forEach(it => next.add(it.id));
                                        setSelectedLowStockIds(next);
                                    }
                                }}
                                className="text-[11px] font-semibold text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 transition-colors cursor-pointer"
                            >
                                {allFilteredSelected ? "Deselect Filtered" : "Select All"}
                            </button>
                        )}
                    </div>

                    {/* Filter Pills */}
                    <div className="flex items-center gap-1.5 text-[10px]">
                        <button
                            type="button"
                            onClick={() => setLowStockFilter('all')}
                            className={`px-2.5 py-1 rounded-full font-semibold transition-all cursor-pointer ${lowStockFilter === 'all'
                                ? 'bg-pink-600 text-white shadow-sm'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                        >
                            All ({msg.lowStockItems.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setLowStockFilter('out_of_stock')}
                            className={`px-2.5 py-1 rounded-full font-semibold transition-all cursor-pointer ${lowStockFilter === 'out_of_stock'
                                ? 'bg-rose-600 text-white shadow-sm'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                        >
                            Out of Stock ({outOfStockCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => setLowStockFilter('low_stock')}
                            className={`px-2.5 py-1 rounded-full font-semibold transition-all cursor-pointer ${lowStockFilter === 'low_stock'
                                ? 'bg-amber-600 text-white shadow-sm'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                        >
                            Low Stock ({lowStockCount})
                        </button>
                    </div>
                </div>

                {/* Items List */}
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
                    {filteredItems.map(item => {
                        const isSelected = selectedLowStockIds.has(item.id);
                        const currentQty = lowStockQuantities[item.id] || item.suggested_quantity || 10;
                        const isOut = item.current_stock === 0;

                        return (
                            <div
                                key={item.id}
                                onClick={() => {
                                    if (!canManagePRs) return;
                                    const next = new Set(selectedLowStockIds);
                                    if (next.has(item.id)) next.delete(item.id);
                                    else next.add(item.id);
                                    setSelectedLowStockIds(next);
                                }}
                                className={`p-3 rounded-2xl border transition-all ${canManagePRs ? 'cursor-pointer' : ''} ${isSelected
                                    ? 'bg-[#ffe6f0] dark:bg-[#341427] border-pink-300 dark:border-[#67224c] shadow-[0_2px_8px_rgba(244,63,94,0.15),inset_0_1px_0_#ffffff] dark:shadow-[0_2px_8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)]'
                                    : 'bg-white dark:bg-slate-900/60 border-slate-200/90 dark:border-[#353746] shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0_#ffffff] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-pink-200 dark:hover:border-pink-500/30'
                                    }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-start gap-2.5 min-w-0">
                                        {canManagePRs && (
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
                                                    {item.item_name}
                                                </span>
                                                <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${isOut
                                                    ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40'
                                                    : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40'
                                                    }`}>
                                                    {isOut ? 'Out of Stock' : 'Low Stock'}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                                                <span>Code: <strong className="text-slate-700 dark:text-slate-300 font-mono text-[10px]">{item.item_code}</strong></span>
                                                <span>•</span>
                                                <span>Stock: <strong className={isOut ? 'text-rose-600 font-bold' : 'text-amber-600 font-bold'}>{item.current_stock}</strong> / Min: {item.minimum_stock}</span>
                                            </div>

                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate flex items-center gap-1">
                                                <span>Supplier:</span>
                                                <strong className="text-slate-700 dark:text-slate-200">{item.supplier_name || item.supplier || 'Default Supplier'}</strong>
                                            </p>
                                        </div>
                                    </div>

                                    {/* Quantity Counter & Estimated Total */}
                                    <div className="text-right shrink-0" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center gap-1 justify-end bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setLowStockQuantities(prev => ({
                                                        ...prev,
                                                        [item.id]: Math.max(1, currentQty - 5)
                                                    }));
                                                }}
                                                className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold transition-colors cursor-pointer"
                                            >
                                                -
                                            </button>
                                            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 px-1 min-w-[24px] text-center">
                                                {currentQty}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setLowStockQuantities(prev => ({
                                                        ...prev,
                                                        [item.id]: currentQty + 5
                                                    }));
                                                }}
                                                className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold transition-colors cursor-pointer"
                                            >
                                                +
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            Est: ₱{(currentQty * (item.purchase_price || 100)).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* PR Action Buttons */}
                {canManagePRs ? (
                    <div className="space-y-2 pt-1">
                        {actionFeedback && (
                            <p className="text-xs text-pink-600 dark:text-pink-400 font-medium animate-pulse text-center">
                                {actionFeedback}
                            </p>
                        )}
                        <AppButton
                            type="button"
                            variant="pink"
                            size="sm"
                            pill
                            disabled={selectedLowStockIds.size === 0 || isCreatingPR}
                            onClick={() => handleBatchCreatePRs(msg.id)}
                            className="w-full justify-center text-xs shadow-md"
                        >
                            <i className="fas fa-file-invoice text-[11px] shrink-0" />
                            <span>Create Purchase Request ({selectedLowStockIds.size}) & Notify Admin/Executive</span>
                        </AppButton>
                    </div>
                ) : (
                    <p className="text-[11px] text-slate-400 text-center py-1">
                        🔒 Only Admin, Executive, and Manager can create purchase requests.
                    </p>
                )}
            </div>
        );
    };

    const renderCreatedPRsWidget = (msg: Message) => {
        if (!msg.createdPRs || msg.createdPRs.length === 0) return null;

        return (
            <div className="mt-3.5 pt-3 border-t border-slate-200/90 dark:border-[#353746] space-y-2.5">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                        <i className="fas fa-check-circle text-emerald-500" />
                        Generated Purchase Requests ({msg.createdPRs.length})
                    </span>
                    <Link
                        href="/procurement"
                        onClick={onClose}
                        className="text-[11px] font-semibold text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 flex items-center gap-1"
                    >
                        <span>View in Procurement</span>
                        <i className="fas fa-external-link-alt text-[10px]" />
                    </Link>
                </div>

                <div className="space-y-2">
                    {msg.createdPRs.map((pr: any, idx: number) => (
                        <div
                            key={pr.id || idx}
                            className="p-3 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/90 dark:border-[#353746] shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0_#ffffff] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)] flex items-center justify-between gap-3"
                        >
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                                        {pr.request_number}
                                    </span>
                                    <StatusBadge tone="neutral" size="xs">
                                        {pr.priority || 'Normal'}
                                    </StatusBadge>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                    {pr.supplier_name} • ₱{(pr.amount || 0).toLocaleString()}
                                </p>
                            </div>

                            <Link
                                href={`/procurement?search=${encodeURIComponent(pr.request_number)}`}
                                onClick={onClose}
                                className="shrink-0"
                            >
                                <AppButton
                                    type="button"
                                    variant="pink"
                                    size="xs"
                                    pill
                                    className="text-[11px]"
                                >
                                    <span>Filter PR</span>
                                    <i className="fas fa-arrow-right text-[10px] shrink-0" />
                                </AppButton>
                            </Link>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderCreatedPOsWidget = (msg: Message) => {
        if (!msg.createdPOs || msg.createdPOs.length === 0) return null;

        return (
            <div className="mt-3.5 pt-3 border-t border-slate-200/90 dark:border-[#353746] space-y-2.5">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                        <i className="fas fa-check-circle text-emerald-500" />
                        Generated Purchase Orders ({msg.createdPOs.length})
                    </span>
                    <Link
                        href={`/purchase-orders?search=${encodeURIComponent(msg.createdPOs[0]?.po_number || '')}`}
                        onClick={onClose}
                        className="text-[11px] font-semibold text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 flex items-center gap-1"
                    >
                        <span>View in PO Page</span>
                        <i className="fas fa-external-link-alt text-[10px]" />
                    </Link>
                </div>

                <div className="space-y-2">
                    {msg.createdPOs.map((po: any, idx: number) => (
                        <div
                            key={po.id || idx}
                            className="p-3 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/90 dark:border-[#353746] shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0_#ffffff] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)] flex items-center justify-between gap-3"
                        >
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                                        {po.po_number}
                                    </span>
                                    <StatusBadge tone={po.status === 'Sent' ? 'blue' : 'amber'} size="xs">
                                        {po.status}
                                    </StatusBadge>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                    {po.supplier_name} • ₱{(po.total_amount || 0).toLocaleString()}
                                </p>
                            </div>

                            <Link
                                href={`/purchase-orders?search=${encodeURIComponent(po.po_number)}`}
                                onClick={onClose}
                                className="shrink-0"
                            >
                                <AppButton
                                    type="button"
                                    variant="pink"
                                    size="xs"
                                    pill
                                    className="text-[11px]"
                                >
                                    <span>Filter PO</span>
                                    <i className="fas fa-arrow-right text-[10px] shrink-0" />
                                </AppButton>
                            </Link>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const formatCleanContent = (text: string) => {
        if (!text) return '';
        return text
            .replace(/^#{1,6}\s+/gm, '') // Remove ###, ##, # headers
            .replace(/\*\*(.*?)\*\*/g, '$1') // Remove **bold**
            .replace(/\*(.*?)\*/g, '$1') // Remove *italic*
            .replace(/`([^`]+)`/g, '$1') // Remove inline code ticks
            .replace(/###/g, '') // Remove any raw ###
            .replace(/\*\*/g, '') // Remove any raw **
            .trim();
    };

    const renderMessageContent = (msg: Message) => {
        if (msg.isThinking) {
            return (
                <div className="flex items-center gap-2">
                    <ThinkingDots />
                    <span className="text-xs text-slate-400">
                        {msg.attachment ? "Analyzing document & checking records..." : "Thinking..."}
                    </span>
                </div>
            );
        }

        if (msg.content.startsWith('⏳')) {
            return (
                <div className="flex items-center gap-2">
                    <span className="animate-pulse">⏳</span>
                    <span className="text-sm text-slate-500">{formatCleanContent(msg.content.replace('⏳', ''))}</span>
                </div>
            );
        }

        return (
            <div>
                {/* User Attachment Preview - Rendered first in bubble */}
                {msg.attachment && (
                    <div className="mb-2.5">
                        {msg.attachment.type.startsWith('image/') && msg.attachment.dataUrl ? (
                            <div className="overflow-hidden rounded-xl border border-white/25 shadow-md bg-black/20 max-w-full">
                                <img
                                    src={msg.attachment.dataUrl}
                                    alt={msg.attachment.name}
                                    className="max-h-48 w-full object-contain mx-auto rounded-xl bg-black/10"
                                />
                                <div className="p-1.5 bg-black/40 backdrop-blur-xs flex items-center justify-between text-[10px] text-white/90">
                                    <span className="truncate max-w-[200px] font-medium">{msg.attachment.name}</span>
                                    <span className="opacity-75 font-mono">{(msg.attachment.size / 1024).toFixed(1)} KB</span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/20 dark:bg-black/40 border border-white/25 backdrop-blur-md text-xs font-semibold">
                                <div className={`w-8 h-8 rounded-lg ${msg.attachment.type.startsWith('image/') ? 'bg-pink-500/80' : 'bg-rose-500/80'} text-white flex items-center justify-center shrink-0`}>
                                    <i className={`fas ${msg.attachment.type.startsWith('image/') ? 'fa-image' : 'fa-file-pdf'} text-sm`} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-white text-xs font-medium">{msg.attachment.name}</p>
                                    <p className="text-[10px] text-white/70">{(msg.attachment.size / 1024).toFixed(1)} KB • {msg.attachment.type.startsWith('image/') ? 'Image' : 'Document'}</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <p className="text-sm whitespace-pre-wrap leading-relaxed">{formatCleanContent(msg.content)}</p>

                {/* System Match Found in /documents or /gallery Card */}
                {msg.matchedDocument && (
                    <div className="mt-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700/60 shadow-[0_2px_12px_rgba(16,185,129,0.12)] space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="w-7 h-7 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs shrink-0 border border-emerald-200 dark:border-emerald-800/40">
                                    <i className={`fas ${msg.matchedDocument.is_gallery ? 'fa-image' : 'fa-file-alt'}`} />
                                </span>
                                <div className="min-w-0">
                                    <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                        {msg.matchedDocument.title || msg.matchedDocument.file_name}
                                    </h4>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                        {msg.matchedDocument.file_name}
                                    </p>
                                </div>
                            </div>
                            <StatusBadge tone="emerald" size="xs">
                                System Match
                            </StatusBadge>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] p-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                            <div>
                                <span className="text-slate-400 block text-[10px]">Supplier / Vendor:</span>
                                <strong className="text-slate-700 dark:text-slate-200 truncate block">
                                    {msg.matchedDocument.supplier || '—'}
                                </strong>
                            </div>
                            <div>
                                <span className="text-slate-400 block text-[10px]">PO / Reference:</span>
                                <strong className="text-slate-700 dark:text-slate-200 font-mono text-[10px] truncate block">
                                    {msg.matchedDocument.po_number || '—'}
                                </strong>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] text-slate-400">
                                Uploaded by {msg.matchedDocument.uploaded_by}
                            </span>
                            <Link
                                href={msg.matchedDocument.view_link}
                                onClick={onClose}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-xs transition-all cursor-pointer"
                            >
                                <span>Open in {msg.matchedDocument.is_gallery ? 'Gallery' : 'Documents'}</span>
                                <i className="fas fa-arrow-right text-[10px]" />
                            </Link>
                        </div>
                    </div>
                )}

                {/* Out of Scope Card */}
                {msg.isOutOfScope && (
                    <div className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
                        <i className="fas fa-info-circle text-amber-600 mt-0.5 shrink-0" />
                        <div>
                            <p className="font-semibold">Notice: Out-of-Scope Query</p>
                            <p className="text-[11px] opacity-90 mt-0.5">Airship Express AI focuses on Supply Chain operations, document OCR, inventory tracking, and procurement.</p>
                        </div>
                    </div>
                )}

                {renderPendingRequestsWidget(msg)}
                {renderCreatedPOsWidget(msg)}
                {renderLowStockWidget(msg)}
                {renderCreatedPRsWidget(msg)}
            </div>
        );
    };

    if (!isOpen) {
        if (messages.length > 1) {
            return (
                <button
                    type="button"
                    onClick={() => openChat()}
                    className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2.5 h-10 px-3.5 rounded-full bg-white dark:bg-[#2a2a2e] text-slate-900 dark:text-white border border-slate-200/90 dark:border-slate-800 shadow-xl backdrop-blur-md hover:border-pink-300 dark:hover:border-pink-900/50 hover:shadow-2xl transition-all duration-200 cursor-pointer group active:scale-95 animate-in fade-in zoom-in-95"
                    title="Expand active chat"
                >
                    <div className="relative flex items-center justify-center">
                        <RobotAvatar size={24} isThinking={isLoading} isResponding={isStreaming} />
                        <span className="absolute -bottom-0.5 -right-0.5 flex h-2 w-2 items-center justify-center">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                        </span>
                    </div>

                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Chat
                    </span>

                    <span className="px-1.5 py-0.2 rounded-full bg-pink-100 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400 border border-pink-200/80 dark:border-pink-900/40 text-[10px] font-bold">
                        {messages.length - 1}
                    </span>

                    <i className="fas fa-chevron-up text-[10px] text-slate-400 group-hover:text-pink-500 transition-transform group-hover:-translate-y-0.5" />
                </button>
            );
        }
        return null;
    }

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-slate-950/60 dark:bg-slate-950/75 backdrop-blur-md z-40 animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Chat Drawer */}
            <div 
                data-lenis-prevent
                className="fixed top-0 right-0 h-full w-full sm:w-[440px] 
                        bg-white dark:bg-[#2a2a2e] text-slate-900 dark:text-white backdrop-blur-2xl
                        z-50 animate-in slide-in-from-right duration-300 
                        flex flex-col font-sans overscroll-contain
                        shadow-[0_20px_60px_rgba(0,0,0,0.2),inset_0_1px_0_#ffffff] dark:shadow-2xl 
                        border-l border-slate-200/90 dark:border-slate-800"
            >

                {/* Header with Robot */}
                <div className="bg-gradient-to-r from-pink-600 via-pink-500 to-rose-500 dark:from-[#2a2a2e] dark:via-slate-900 dark:to-[#2a2a2e] px-5 py-4 flex items-center justify-between shrink-0 shadow-[0_4px_16px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.3)] dark:shadow-lg z-10 border-b border-pink-400/30 dark:border-slate-800 transition-colors">
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
                            <h2 className="text-white dark:text-slate-100 font-bold text-sm tracking-tight leading-snug">
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
                    <div className="flex items-center gap-1.5">
                        {messages.length > 1 && (
                            <button
                                onClick={onClose}
                                className="text-white/90 dark:text-slate-300 hover:text-white dark:hover:text-pink-300 p-2 rounded-full bg-white/10 hover:bg-white/20 dark:bg-slate-800/80 dark:hover:bg-slate-700 border border-white/20 dark:border-slate-700 shadow-[0_2px_6px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.2)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition-all duration-150 active:scale-95 cursor-pointer"
                                title="Minimize chat"
                                aria-label="Minimize assistant drawer"
                            >
                                <i className="fas fa-minus text-xs" />
                            </button>
                        )}

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
                                className="text-white/90 dark:text-slate-300 hover:text-white dark:hover:text-pink-300 p-2 rounded-full bg-white/10 hover:bg-white/20 dark:bg-slate-800/80 dark:hover:bg-slate-700 border border-white/20 dark:border-slate-700 shadow-[0_2px_6px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.2)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition-all duration-150 active:scale-95 cursor-pointer"
                                title="Clear chat"
                                aria-label="Clear chat history"
                            >
                                <i className="fas fa-trash-alt text-xs" />
                            </button>
                        )}

                        <button
                            onClick={onClose}
                            className="text-white/90 dark:text-slate-300 hover:text-white dark:hover:text-pink-300 p-2 rounded-full bg-white/10 hover:bg-white/20 dark:bg-slate-800/80 dark:hover:bg-slate-700 border border-white/20 dark:border-slate-700 shadow-[0_2px_6px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.2)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition-all duration-150 active:scale-95 cursor-pointer"
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
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-[0_2px_8px_rgba(244,63,94,0.3),inset_0_1px_0_rgba(255,255,255,0.4)] bg-gradient-to-tr from-pink-600 to-rose-500 text-white border border-pink-400/40">
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
                                    className={`max-w-[84%] space-y-1.5 ${msg.type === "user" ? "items-end" : "items-start"
                                        }`}
                                >
                                    {/* Message Bubble */}
                                    <div
                                        className={`rounded-2xl px-4 py-3 text-sm leading-relaxed transition-colors ${msg.type === "user"
                                            ? "bg-gradient-to-tr from-pink-600 to-rose-500 text-white rounded-tr-none font-normal shadow-[0_4px_14px_rgba(244,63,94,0.3),inset_0_1px_0_rgba(255,255,255,0.35)] border border-pink-400/40"
                                            : "bg-white dark:bg-[#1e1e22] text-slate-800 dark:text-slate-100 border border-slate-200/90 dark:border-slate-800 rounded-tl-none font-normal shadow-xs dark:shadow-lg backdrop-blur-md"
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
                                        <div className="pt-2 space-y-2">
                                            <span className="text-[11px] font-bold text-pink-600/90 dark:text-pink-400 flex items-center gap-1">
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
                                                        className="text-xs font-semibold bg-[#ffe6f0] hover:bg-[#ffd9e8] text-pink-700 border border-pink-300/90 shadow-[0_2px_6px_rgba(244,63,94,0.16),0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_0_#ffffff] dark:bg-[#341427] dark:hover:bg-[#421932] dark:text-pink-200 dark:border-[#67224c] dark:shadow-[0_3px_8px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.1)] px-3.5 py-1.5 rounded-full transition-all duration-200 active:scale-95 text-left cursor-pointer"
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
                            <div className="flex items-center gap-2 text-xs font-semibold text-pink-600 dark:text-pink-400 bg-[#ffe6f0] dark:bg-[#341427] border border-pink-200 dark:border-[#67224c] px-3.5 py-1.5 rounded-full w-fit animate-pulse shadow-xs backdrop-blur-sm">
                                <i className="fas fa-circle-notch fa-spin text-xs" />
                                <span>Thinking...</span>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Floating Scroll-to-Bottom Button */}
                    {showScrollButton && (
                        <button
                            onClick={scrollToBottom}
                            className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#ffe6f0] hover:bg-[#ffd9e8] text-pink-700 border border-pink-300/90 shadow-[0_4px_12px_rgba(244,63,94,0.25),inset_0_1px_0_#ffffff] dark:bg-[#341427] dark:hover:bg-[#421932] dark:text-pink-200 dark:border-[#67224c] dark:shadow-[0_4px_14px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.15)] rounded-full p-2.5 transition-all duration-200 hover:scale-105 active:scale-95 z-10 cursor-pointer"
                            aria-label="Scroll to bottom"
                        >
                            <i className="fas fa-arrow-down text-xs" />
                            <span className="sr-only">Scroll to bottom</span>
                        </button>
                    )}
                </div>

                {/* Quick Prompts */}
                {messages.length < 3 && (
                    <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-white/90 dark:bg-[#2a2a2e] backdrop-blur-md shrink-0 transition-colors">
                        {/* Header */}
                        <p className="text-[11px] font-bold text-pink-600 dark:text-pink-400 mb-2.5 flex items-center gap-1.5 uppercase tracking-wider">
                            <i className="fas fa-sparkles text-pink-500 dark:text-pink-400 text-[11px]" />
                            <span>Quick Prompts</span>
                        </p>

                        {/* Prompt Buttons Container */}
                        <div className="flex flex-wrap gap-1.5">
                            {SUGGESTED_QUESTIONS.map((q) => (
                                <button
                                    key={q}
                                    onClick={() => handleSuggested(q)}
                                    disabled={isLoading}
                                    className="text-xs font-semibold bg-slate-100 hover:bg-[#ffe6f0] text-slate-700 hover:text-pink-700 border border-slate-200/90 hover:border-pink-300 shadow-[0_2px_6px_rgba(0,0,0,0.06),inset_0_1px_0_#ffffff] dark:bg-slate-800 dark:hover:bg-[#341427] dark:text-slate-200 dark:hover:text-pink-200 dark:border-slate-700 dark:hover:border-[#67224c] dark:shadow-[0_3px_8px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.1)] px-3.5 py-1.5 rounded-full transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 cursor-pointer"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Input Area */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-[#2a2a2e] backdrop-blur-xl shrink-0 shadow-lg transition-all">
                    
                    {/* Attachment Preview Chip */}
                    {attachedFile && (
                        <div className="mb-2 p-2 px-3 rounded-2xl bg-pink-50/90 dark:bg-[#341427]/90 border border-pink-200 dark:border-[#67224c] flex items-center justify-between gap-2 text-xs animate-in fade-in zoom-in-95 duration-150">
                            <div className="flex items-center gap-2 min-w-0">
                                {attachedFile.type.startsWith('image/') ? (
                                    <img
                                        src={attachedFile.dataUrl}
                                        alt="Preview"
                                        className="w-8 h-8 rounded-lg object-cover border border-pink-300 dark:border-pink-800 shrink-0"
                                    />
                                ) : (
                                    <div className="w-8 h-8 rounded-lg bg-pink-100 dark:bg-pink-950/80 text-pink-600 dark:text-pink-400 flex items-center justify-center shrink-0">
                                        <i className="fas fa-file-pdf text-sm" />
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <p className="text-xs font-semibold text-slate-800 dark:text-white truncate">
                                        {attachedFile.name}
                                    </p>
                                    <p className="text-[10px] text-pink-600 dark:text-pink-400">
                                        {(attachedFile.size / 1024).toFixed(1)} KB • Ready to analyze
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleRemoveAttachment}
                                className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-full transition-colors cursor-pointer"
                                title="Remove attachment"
                            >
                                <i className="fas fa-times text-xs" />
                            </button>
                        </div>
                    )}

                    <div className="relative flex items-center gap-1.5">
                        {/* Hidden file input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/csv"
                            onChange={handleFileSelect}
                            className="hidden"
                        />

                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLoading}
                            className="p-2.5 rounded-xl bg-slate-100 hover:bg-pink-50 text-slate-500 hover:text-pink-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-400 dark:hover:text-pink-400 transition-colors border border-slate-200/80 dark:border-slate-700/60 shrink-0 cursor-pointer disabled:opacity-50"
                            title="Attach picture or document to analyze"
                            aria-label="Attach picture or document"
                        >
                            <i className="fas fa-paperclip text-sm" />
                        </button>

                        <div className="relative flex-1 flex items-center">
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={attachedFile ? "Ask something about this file (or press enter)..." : "Ask about inventory, stock, or attach docs..."}
                                className="w-full bg-slate-50/90 dark:bg-slate-900/70 border border-slate-200/90 dark:border-[#353746] rounded-2xl pl-4 pr-12 py-3 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-pink-500 dark:focus:border-pink-500/80 focus:ring-2 focus:ring-pink-500/20 transition-all duration-150 backdrop-blur-sm"
                                disabled={isLoading}
                            />

                            <button
                                onClick={() => handleSendMessage()}
                                disabled={(!input.trim() && !attachedFile) || isLoading}
                                aria-label="Send message"
                                className="absolute right-2 w-8 h-8 rounded-full bg-gradient-to-tr from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white disabled:opacity-40 disabled:hover:from-pink-600 disabled:hover:to-rose-500 disabled:cursor-not-allowed shadow-[0_2px_8px_rgba(244,63,94,0.35),inset_0_1px_0_rgba(255,255,255,0.4)] border border-pink-400/40 flex items-center justify-center transition-all duration-150 active:scale-95 cursor-pointer"
                            >
                                <i className={`fas ${isLoading ? 'fa-spinner fa-spin' : 'fa-arrow-up'} text-xs`} />
                            </button>
                        </div>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between px-1">
                        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                            {isLoading ? (
                                <>
                                    <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-ping" />
                                    <span>Processing request...</span>
                                </>
                            ) : (
                                <span>Press <kbd className="px-1.5 py-0.5 rounded text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-mono">Enter</kbd> to send</span>
                            )}
                        </span>

                        <span className="text-[10px] font-bold text-pink-500/90 dark:text-pink-400/90 uppercase tracking-wider flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-pink-500 dark:bg-pink-400" />
                            Warehouse AI
                        </span>
                    </div>
                </div>
            </div>
        </>
    );
}