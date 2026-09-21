// app/components/ai/AIChatbot.tsx
"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAI } from "./AIContext";
import { motion, AnimatePresence, useMotionValue, animate } from "framer-motion";
import { calculateGrabbableCollision } from "../../lib/grabbablePhysics";
// Import robot components
import { RobotAvatar, RobotHeader } from "../components";
import AppButton from "../../components/ui/AppButton";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { user } from "../../lib/services/Class/user";
import { ShieldAlert, Clock, AlertTriangle, GripVertical, Minus, Maximize2, Minimize2, X, Sparkles, Eye, Download, ExternalLink, ZoomIn, ZoomOut, RotateCw, FileText, Image as ImageIcon, FileCheck, Layers, Search, RefreshCw, Copy, Check } from "lucide-react";
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
    mode?: 'normal' | 'search_document';
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
    storage_path?: string | null;
    public_url?: string | null;
    file_url?: string | null;
    file_type?: string;
    file_size?: number | null;
    notes?: string | null;
    source_type?: string;
    target_label?: string;
    is_gallery: boolean;
    view_link: string;
    match_reason?: string;
    matched_criteria?: {
        label: string;
        inserted_value: string;
        matched_value: string;
    }[];
}
interface Message {
    id: string;
    type: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    isThinking?: boolean;
    attachment?: AttachedFile;
    matchedDocument?: MatchedDocument;
    matchedDocuments?: MatchedDocument[];
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
    if (!text)
        return text;
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
    return (<span className="inline-flex gap-1 items-center min-w-[20px]">
            <span className="w-1.5 h-1.5 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
            <span className="w-1.5 h-1.5 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="w-1.5 h-1.5 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
        </span>);
}

// Global in-memory image cache to avoid re-fetching or re-decoding document previews
const imageCache = new Set<string>();

interface OptimizedDocumentPreviewImageProps {
    src: string;
    alt: string;
    className?: string;
    aspectRatio?: string;
    fit?: 'cover' | 'contain';
    onLoad?: () => void;
}

function OptimizedDocumentPreviewImage({
    src,
    alt,
    className = "",
    aspectRatio = "aspect-[16/9]",
    fit = "cover",
    onLoad,
}: OptimizedDocumentPreviewImageProps) {
    const [isVisible, setIsVisible] = useState<boolean>(() => imageCache.has(src));
    const [isLoaded, setIsLoaded] = useState<boolean>(() => imageCache.has(src));
    const [hasError, setHasError] = useState<boolean>(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!src) return;
        if (imageCache.has(src)) {
            setIsVisible(true);
            setIsLoaded(true);
            return;
        }

        const el = containerRef.current;
        if (!el) return;

        // IntersectionObserver: Only render and load image when in/near viewport
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { rootMargin: "150px" }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [src]);

    const handleImageLoad = () => {
        if (src) imageCache.add(src);
        setIsLoaded(true);
        onLoad?.();
    };

    return (
        <div
            ref={containerRef}
            className={`relative w-full overflow-hidden ${aspectRatio} bg-[#ebf0f7] dark:bg-[#12131b] ${className}`}
            style={{ contentVisibility: "auto", containIntrinsicSize: "320px 180px" }}
        >
            {/* Loading Skeleton */}
            {!isLoaded && !hasError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-200/60 dark:bg-slate-800/60 animate-pulse z-10 text-slate-400 dark:text-slate-500">
                    <ImageIcon className="w-6 h-6 mb-1 opacity-50" />
                    <span className="text-[10px] font-medium tracking-wide">Loading image...</span>
                </div>
            )}

            {/* Error Fallback */}
            {hasError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-rose-50 dark:bg-rose-950/30 text-rose-500 p-2.5 text-center">
                    <AlertTriangle className="w-4 h-4 mb-1" />
                    <span className="text-[10px] font-semibold">Preview unavailable</span>
                </div>
            ) : isVisible ? (
                <img
                    src={src}
                    alt={alt}
                    decoding="async"
                    loading="lazy"
                    onLoad={handleImageLoad}
                    onError={() => setHasError(true)}
                    className={`w-full h-full object-${fit} transition-opacity duration-300 ${
                        isLoaded ? "opacity-100" : "opacity-0"
                    }`}
                />
            ) : null}
        </div>
    );
}

export default function AIChatbot({ isOpen, onClose }: AIChatbotProps) {
    const { openChat, question, setQuestion, isRobotThinking, isRobotResponding, setRobotThinking, setRobotResponding, } = useAI();
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
            }
            catch (e) {
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
    const [activeMode, setActiveMode] = useState<'chat' | 'search'>('chat');
    const [previewModalDoc, setPreviewModalDoc] = useState<MatchedDocument | null>(null);
    const [previewZoom, setPreviewZoom] = useState<number>(1);
    const [previewRotation, setPreviewRotation] = useState<number>(0);
    const [previewModalLoading, setPreviewModalLoading] = useState<boolean>(false);
    const [previewActiveTab, setPreviewActiveTab] = useState<Record<string, string>>({});
    const [copiedPoMap, setCopiedPoMap] = useState<Record<string, boolean>>({});
    const fileInputRef = useRef<HTMLInputElement>(null);
    const searchFileInputRef = useRef<HTMLInputElement>(null);

    const handleCopyPo = (poNumber: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!poNumber || poNumber === '—') return;
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(poNumber);
        }
        setCopiedPoMap(prev => ({ ...prev, [poNumber]: true }));
        setTimeout(() => {
            setCopiedPoMap(prev => ({ ...prev, [poNumber]: false }));
        }, 2000);
    };

    const handleDownloadFile = async (doc: MatchedDocument, e?: React.MouseEvent) => {
        e?.stopPropagation();
        const downloadUrl = doc.public_url || doc.file_url;
        if (!downloadUrl) {
            setActionFeedback("No download link available for this document");
            setTimeout(() => setActionFeedback(null), 3000);
            return;
        }
        try {
            const res = await fetch(downloadUrl);
            const blob = await res.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = doc.file_name || `${doc.title}.${doc.is_gallery ? 'jpg' : 'pdf'}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(blobUrl);
            setActionFeedback("Download initiated!");
            setTimeout(() => setActionFeedback(null), 3000);
        } catch {
            window.open(downloadUrl, '_blank');
        }
    };

    const openDocumentPreview = (doc: MatchedDocument, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setPreviewZoom(1);
        setPreviewRotation(0);
        const url = doc.public_url || doc.file_url || '';
        setPreviewModalLoading(!imageCache.has(url));
        setPreviewModalDoc(doc);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        if (file.size > 10 * 1024 * 1024) {
            setActionFeedback("File size must be under 10MB");
            setTimeout(() => setActionFeedback(null), 4000);
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            setActiveMode('chat');
            setAttachedFile({
                name: file.name,
                type: file.type || "application/octet-stream",
                size: file.size,
                dataUrl,
                mode: 'normal',
            });
        };
        reader.readAsDataURL(file);
        e.target.value = "";
    };

    const handleSearchFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        if (file.size > 10 * 1024 * 1024) {
            setActionFeedback("File size must be under 10MB");
            setTimeout(() => setActionFeedback(null), 4000);
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            setActiveMode('search');
            setAttachedFile({
                name: file.name,
                type: file.type || "application/octet-stream",
                size: file.size,
                dataUrl,
                mode: 'search_document',
            });
        };
        reader.readAsDataURL(file);
        e.target.value = "";
    };

    const handleRemoveAttachment = () => {
        setAttachedFile(null);
    };

    const handleModeSwitch = (mode: 'chat' | 'search') => {
        setActiveMode(mode);
        if (attachedFile) {
            setAttachedFile(prev => prev ? {
                ...prev,
                mode: mode === 'search' ? 'search_document' : 'normal'
            } : null);
        }
    };

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const [hasProcessedQuestion, setHasProcessedQuestion] = useState(false);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [isAtBottom, setIsAtBottom] = useState(true);

    // Chat drawer resizing state
    const [drawerWidth, setDrawerWidth] = useState<number>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('aiChatbotDrawerWidth');
            if (saved) {
                const parsed = parseInt(saved, 10);
                if (!isNaN(parsed) && parsed >= 360 && parsed <= 1200) {
                    return parsed;
                }
            }
        }
        return 440;
    });
    const [isResizing, setIsResizing] = useState(false);
    const isResizingRef = useRef(false);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizingRef.current) return;
            const newWidth = window.innerWidth - e.clientX;
            const minWidth = 360;
            const maxWidth = Math.min(window.innerWidth - 24, 1100);
            const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
            setDrawerWidth(clampedWidth);
            try {
                localStorage.setItem('aiChatbotDrawerWidth', String(clampedWidth));
            } catch (err) {}
        };

        const handleMouseUp = () => {
            if (isResizingRef.current) {
                isResizingRef.current = false;
                setIsResizing(false);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const handleResizeStart = (e: React.MouseEvent) => {
        e.preventDefault();
        isResizingRef.current = true;
        setIsResizing(true);
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
    };

    const toggleWidthExpand = () => {
        setDrawerWidth(prev => {
            const next = prev > 560 ? 440 : 760;
            try {
                localStorage.setItem('aiChatbotDrawerWidth', String(next));
            } catch (err) {}
            return next;
        });
    };

    // Moderation lockout state
    const [isLockedOut, setIsLockedOut] = useState(false);
    const [lockoutSeconds, setLockoutSeconds] = useState(0);

    // Floating launcher grabbable & minimization states
    const [isFloatingMinimized, setIsFloatingMinimized] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('aiChatbotMinimized');
            return saved === 'true';
        }
        return false;
    });
    const [isFloatingDragging, setIsFloatingDragging] = useState(false);
    const hasDraggedRef = useRef(false);
    const [collisionReaction, setCollisionReaction] = useState<string | null>(null);
    const [isWobbling, setIsWobbling] = useState(false);
    const reactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const floatX = useMotionValue(0);
    const floatY = useMotionValue(0);
    const [dragBounds, setDragBounds] = useState({ top: -800, bottom: 64, left: -1200, right: 8 });

    // Update screen boundaries on resize
    useEffect(() => {
        const updateBounds = () => {
            if (typeof window !== 'undefined') {
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                setDragBounds({
                    top: -(vh - 80 - 48 - 16),
                    bottom: 64,
                    left: -(vw - 24 - 48 - 16),
                    right: 8,
                });
            }
        };
        updateBounds();
        window.addEventListener('resize', updateBounds);
        return () => window.removeEventListener('resize', updateBounds);
    }, []);

    // Load and clamp saved position so it is always on-screen
    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('aiChatbotPosition');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (typeof parsed.x === 'number' && Number.isFinite(parsed.x) && typeof parsed.y === 'number' && Number.isFinite(parsed.y)) {
                        const clampedX = Math.min(Math.max(parsed.x, dragBounds.left), dragBounds.right);
                        const clampedY = Math.min(Math.max(parsed.y, dragBounds.top), dragBounds.bottom);
                        floatX.set(clampedX);
                        floatY.set(clampedY);
                        localStorage.setItem('aiChatbotPosition', JSON.stringify({ x: clampedX, y: clampedY }));
                        return;
                    }
                }
            } catch (e) {}
            // Reset to safe on-screen default if corrupted or missing
            floatX.set(0);
            floatY.set(0);
        }
    }, [floatX, floatY, dragBounds]);

    const triggerCollisionReaction = useCallback((pushX?: number, pushY?: number) => {
        const phrases = [
            "Boing! 🤖",
            "Ouch! Watch out! ⚡",
            "Whoops! Personal space! 🚀",
            "Bloop! Safe distance! 🛡️",
            "Hey, watch the antennas! 📡",
            "Bump! Network collision! 🌐",
            "Beep-boop! Bounced! 💥"
        ];
        const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
        setCollisionReaction(randomPhrase);
        setIsWobbling(true);

        if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current);
        reactionTimeoutRef.current = setTimeout(() => {
            setCollisionReaction(null);
            setIsWobbling(false);
        }, 2200);

        if (typeof pushX === 'number' && typeof pushY === 'number') {
            const currentX = floatX.get();
            const currentY = floatY.get();
            const targetX = Math.min(Math.max(currentX + pushX, dragBounds.left), dragBounds.right);
            const targetY = Math.min(Math.max(currentY + pushY, dragBounds.top), dragBounds.bottom);

            animate(floatX, targetX, { type: "spring", stiffness: 360, damping: 22 });
            animate(floatY, targetY, { type: "spring", stiffness: 360, damping: 22 });

            try {
                localStorage.setItem('aiChatbotPosition', JSON.stringify({ x: targetX, y: targetY }));
            } catch (e) {}
        }
    }, [floatX, floatY, dragBounds]);

    const handleFloatingDragStart = useCallback(() => {
        setIsFloatingDragging(true);
        hasDraggedRef.current = true;
    }, []);

    const handleFloatingDragEnd = useCallback(() => {
        setIsFloatingDragging(false);
        setTimeout(() => {
            hasDraggedRef.current = false;
        }, 120);

        const currentX = Math.min(Math.max(floatX.get(), dragBounds.left), dragBounds.right);
        const currentY = Math.min(Math.max(floatY.get(), dragBounds.top), dragBounds.bottom);
        floatX.set(currentX);
        floatY.set(currentY);

        try {
            localStorage.setItem('aiChatbotPosition', JSON.stringify({
                x: currentX,
                y: currentY
            }));
        } catch (e) {}

        // Check collision with Offline Indicator
        const robotEl = document.getElementById('grabbable-ai-robot');
        const offlineEl = document.getElementById('grabbable-offline-indicator');
        const collision = calculateGrabbableCollision(robotEl, offlineEl);

        if (collision?.collided) {
            triggerCollisionReaction(collision.robotPush.x, collision.robotPush.y);
            window.dispatchEvent(new CustomEvent('supplychain:grabbable-bounce', {
                detail: { source: 'robot', push: collision.offlinePush }
            }));
        }
    }, [floatX, floatY, dragBounds, triggerCollisionReaction]);

    // Listen to bounce events dispatched when the offline indicator is dragged into the robot
    useEffect(() => {
        const handleExternalBounce = (e: Event) => {
            const customEvent = e as CustomEvent<{ source: string; push: { x: number; y: number } }>;
            if (customEvent.detail?.source === 'offline') {
                triggerCollisionReaction(customEvent.detail.push.x, customEvent.detail.push.y);
            }
        };
        window.addEventListener('supplychain:grabbable-bounce', handleExternalBounce);
        return () => window.removeEventListener('supplychain:grabbable-bounce', handleExternalBounce);
    }, [triggerCollisionReaction]);

    // Check moderation status on open (deferred to not block animation frames)
    useEffect(() => {
        if (!isOpen) return;
        const currentUser = user.getUser();
        const identifier = currentUser.email || currentUser.userId;
        if (!identifier) return;

        const timer = setTimeout(() => {
            fetch(`/ai/api/moderation-status?identifier=${encodeURIComponent(identifier)}`)
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.isLockedOut && data.lockoutRemainingSeconds > 0) {
                        setIsLockedOut(true);
                        setLockoutSeconds(data.lockoutRemainingSeconds);
                    }
                })
                .catch(() => {});
        }, 120);

        return () => clearTimeout(timer);
    }, [isOpen]);

    // Countdown interval for lockout
    useEffect(() => {
        if (!isLockedOut || lockoutSeconds <= 0) return;
        const interval = setInterval(() => {
            setLockoutSeconds(prev => {
                if (prev <= 1) {
                    setIsLockedOut(false);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [isLockedOut, lockoutSeconds]);
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
            }
            catch (e) {
                console.warn("Storage quota exceeded, clearing older cache:", e);
                try {
                    // Fallback: store only the last 5 basic text messages
                    const minimalMessages = messages
                        .filter(m => !m.isThinking && !m.content.startsWith('⏳'))
                        .slice(-5)
                        .map(m => ({ id: m.id, type: m.type, content: m.content, timestamp: m.timestamp }));
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(minimalMessages));
                }
                catch (fallbackErr) {
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
        }
        else {
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
        }
        else {
            setHasProcessedQuestion(false);
        }
    }, [isOpen, question]);
    const handleSendMessage = async (customQuestion?: string) => {
        const currentFile = attachedFile;
        setAttachedFile(null);
        const trimmed = (customQuestion || input).trim();
        const userPrompt = trimmed || (currentFile ? (currentFile.mode === 'search_document' ? `Search document in database with photo: ${currentFile.name}` : `Analyze this file: ${currentFile.name}`) : "");
        if (!userPrompt && !currentFile)
            return;
        if (isLoading)
            return;
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
                const currentRole = user.getRole() || 'User';
                const currentUserName = user.getName() || 'User';
                const currentUserEmail = user.getEmail() || '';
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
                        mode: currentFile.mode || (activeMode === 'search' ? 'search_document' : 'normal'),
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
                const matchedDocsList: MatchedDocument[] = docData.matchedDocuments && docData.matchedDocuments.length > 0
                    ? docData.matchedDocuments
                    : (docData.matchedDocument ? [docData.matchedDocument] : []);
                const primaryMatch: MatchedDocument | undefined = docData.matchedDocument || (matchedDocsList.length > 0 ? matchedDocsList[0] : undefined);

                setMessages(prev => prev.map(m => {
                    if (m.id === assistantMsgId) {
                        return {
                            ...m,
                            content: docData.response || 'Document analysis completed.',
                            isThinking: false,
                            attachment: currentFile,
                            matchedDocument: primaryMatch,
                            matchedDocuments: matchedDocsList.length > 0 ? matchedDocsList : undefined,
                            isOutOfScope: docData.isOutOfScope || false,
                            suggestions: docData.isOutOfScope
                                ? ['Show me low stock items', 'Check current inventory status', 'View recent purchase orders']
                                : [
                                    primaryMatch ? `Preview ${primaryMatch.title || 'matched file'}` : 'Search another photo/receipt',
                                    primaryMatch ? (primaryMatch.is_gallery ? 'View in Gallery' : 'View in Documents') : 'View documents repository',
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
            }
            catch (docErr: any) {
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
            const currentUser = user.getUser();
            const currentRole = currentUser.role || 'User';
            const currentUserId = user.getUserId();
            const currentUserEmail = currentUser.email;
            const currentUserName = user.getName();

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
                        role: currentRole,
                        userId: currentUserId,
                        userEmail: currentUserEmail,
                        userName: currentUserName,
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
                setMessages(prev => prev.map(msg => msg.id === assistantMsgId
                    ? { ...msg, isThinking: false }
                    : msg));
                let buffer = '';
                while (true) {
                    const { done, value } = await reader.read();
                    if (done)
                        break;
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n\n');
                    // Keep the last partial line (if any) in the buffer
                    buffer = lines.pop() || '';
                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (trimmedLine.startsWith('data: ')) {
                            try {
                                const jsonStr = trimmedLine.slice(6);
                                if (jsonStr.trim() === '')
                                    continue;
                                const data = JSON.parse(jsonStr);
                                if (data.type === 'chunk') {
                                    hasReceivedChunk = true;
                                    if (data.full) {
                                        fullContent = data.full;
                                    }
                                    else if (data.content) {
                                        fullContent += data.content;
                                    }
                                    setMessages(prev => prev.map(msg => msg.id === assistantMsgId
                                        ? {
                                            ...msg,
                                            content: stripMarkdown(fullContent),
                                            isThinking: false,
                                        }
                                        : msg));
                                }
                                else if (data.type === 'done') {
                                    if (data.moderation?.isLockedOut || (data.moderation?.lockoutRemainingSeconds && data.moderation.lockoutRemainingSeconds > 0)) {
                                        setIsLockedOut(true);
                                        setLockoutSeconds(data.moderation.lockoutRemainingSeconds);
                                    }
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
                                    setMessages(prev => prev.map(msg => msg.id === assistantMsgId
                                        ? {
                                            ...msg,
                                            content: stripMarkdown(data.content || fullContent),
                                            timestamp: new Date(),
                                            isThinking: false,
                                            suggestions: metaData?.suggestions || [],
                                            pendingRequests: prData,
                                            lowStockItems: lowStockData,
                                        }
                                        : msg));
                                }
                                else if (data.type === 'error') {
                                    throw new Error(data.content || 'Stream error');
                                }
                                else if (data.type === 'status') {
                                    setMessages(prev => prev.map(msg => msg.id === assistantMsgId
                                        ? {
                                            ...msg,
                                            content: `${data.content}`,
                                            isThinking: true,
                                        }
                                        : msg));
                                }
                            }
                            catch (parseError) {
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
            }
            catch (streamError) {
                console.log('Streaming failed:', streamError);
                setIsStreaming(false);
                setRobotResponding(false);
            }
            // Fallback to non-streaming
            setMessages(prev => prev.map(msg => msg.id === assistantMsgId
                ? { ...msg, isThinking: false }
                : msg));
            const response = await fetch('/ai/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question: trimmed,
                    history: history,
                    role: currentRole,
                    userId: currentUserId,
                    userEmail: currentUserEmail,
                    userName: currentUserName,
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
            if (data.moderation?.isLockedOut || (data.moderation?.lockoutRemainingSeconds && data.moderation.lockoutRemainingSeconds > 0)) {
                setIsLockedOut(true);
                setLockoutSeconds(data.moderation.lockoutRemainingSeconds);
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
            setMessages(prev => prev.map(msg => msg.id === assistantMsgId
                ? {
                    ...msg,
                    content: stripMarkdown(data.response || 'No response received'),
                    timestamp: new Date(),
                    isThinking: false,
                    suggestions: data.meta?.suggestions || [],
                    pendingRequests: fallbackPRData,
                    lowStockItems: fallbackLowStockData,
                }
                : msg));
        }
        catch (error) {
            const errorMessage = error instanceof Error
                ? error.message
                : 'Sorry, I encountered an error. Please try again.';
            //  Reset robot states on error
            setRobotThinking(false);
            setRobotResponding(false);
            setMessages(prev => prev.map(msg => msg.id === assistantMsgId
                ? {
                    ...msg,
                    content: errorMessage,
                    timestamp: new Date(),
                    isThinking: false,
                }
                : msg));
        }
        finally {
            setIsLoading(false);
            setIsStreaming(false);
            setRobotThinking(false);
            setRobotResponding(false);
        }
    };
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (activeMode === 'search') {
                if (attachedFile) {
                    handleSendMessage();
                }
                return;
            }
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
            const currentRole = user.getRole() || 'Manager';
            const currentUserName = user.getName() || 'Procurement Team';
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
            if (!res.ok || !data.success || !data.createdPOs || data.createdPOs.length === 0) {
                throw new Error(data.error || 'Failed to create Purchase Orders. Please try again.');
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
        }
        catch (err: any) {
            console.error("Error creating POs from chat:", err);
            setActionFeedback(`Error: ${err.message || 'Failed'}`);
            setTimeout(() => setActionFeedback(null), 5000);
        }
        finally {
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
            const currentRole = user.getRole() || 'Manager';
            const currentUserName = user.getName() || 'Inventory Officer';
            const currentUserEmail = user.getEmail() || '';
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
        }
        catch (err: any) {
            console.error("Error creating PRs from chat:", err);
            setActionFeedback(`Error: ${err.message || 'Failed'}`);
            setTimeout(() => setActionFeedback(null), 5000);
        }
        finally {
            setIsCreatingPR(false);
        }
    };
    const renderPendingRequestsWidget = (msg: Message) => {
        if (!msg.pendingRequests || msg.pendingRequests.length === 0)
            return null;
        const currentRole = user.getRole().toLowerCase();
        const canManagePOs = ['admin', 'manager', 'executive', 'employee', 'user'].includes(currentRole);
        const allSelected = msg.pendingRequests.length > 0 && msg.pendingRequests.every(pr => selectedPRIds.has(pr.id));
        return (<div className="mt-3.5 pt-3 border-t border-slate-200/90 dark:border-[#353746] space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse shrink-0"/>
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            Purchase Requests ({msg.pendingRequests.length})
                        </span>
                    </div>

                    {canManagePOs && (<button type="button" onClick={() => {
                    if (allSelected) {
                        setSelectedPRIds(new Set());
                    }
                    else {
                        setSelectedPRIds(new Set(msg.pendingRequests?.map(pr => pr.id) || []));
                    }
                }} className="text-[11px] font-semibold text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 transition-colors cursor-pointer">
                            {allSelected ? "Deselect All" : "Select All"}
                        </button>)}
                </div>

                {/* PR Cards List */}
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
                    {msg.pendingRequests.map(pr => {
                const isSelected = selectedPRIds.has(pr.id);
                return (<div key={pr.id} onClick={() => {
                        if (!canManagePOs)
                            return;
                        const next = new Set(selectedPRIds);
                        if (next.has(pr.id))
                            next.delete(pr.id);
                        else
                            next.add(pr.id);
                        setSelectedPRIds(next);
                    }} className={`p-3 rounded-2xl border transition-all ${canManagePOs ? 'cursor-pointer' : ''} ${isSelected
                        ? 'bg-[#ffe6f0] dark:bg-[#341427] border-pink-300 dark:border-[#67224c] shadow-[0_2px_8px_rgba(244,63,94,0.15),inset_0_1px_0_#ffffff] dark:shadow-[0_2px_8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)]'
                        : 'bg-white dark:bg-slate-900/60 border-slate-200/90 dark:border-[#353746] shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0_#ffffff] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-pink-200 dark:hover:border-pink-500/30'}`}>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-start gap-2 min-w-0">
                                        {canManagePOs && (<input type="checkbox" checked={isSelected} onChange={() => { }} className="mt-0.5 rounded border-slate-300 text-pink-600 focus:ring-pink-500 shrink-0 cursor-pointer"/>)}
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

                                {pr.items && pr.items.length > 0 && (<div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-white/5 flex flex-wrap gap-1">
                                        {pr.items.slice(0, 3).map((it, idx) => (<span key={idx} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                                                {it.name} (x{it.quantity})
                                            </span>))}
                                        {pr.items.length > 3 && (<span className="text-[10px] text-slate-400">+{pr.items.length - 3} more</span>)}
                                    </div>)}
                            </div>);
            })}
                </div>

                {/* Batch Action Buttons */}
                {canManagePOs && (<div className="space-y-2 pt-1">
                        {actionFeedback && (<p className="text-xs text-pink-600 dark:text-pink-400 font-medium animate-pulse text-center">
                                {actionFeedback}
                            </p>)}
                        <div className="flex items-center gap-2">
                            <AppButton type="button" variant="neutral" size="sm" pill disabled={selectedPRIds.size === 0 || isCreatingPO} onClick={() => handleBatchCreatePOs(msg.id, false)} className="flex-1 justify-center text-xs">
                                <i className="fas fa-file-signature text-[11px] shrink-0"/>
                                <span>Create as Draft ({selectedPRIds.size})</span>
                            </AppButton>

                            <AppButton type="button" variant="pink" size="sm" pill disabled={selectedPRIds.size === 0 || isCreatingPO} onClick={() => handleBatchCreatePOs(msg.id, true)} className="flex-1 justify-center text-xs">
                                <i className="fas fa-paper-plane text-[11px] shrink-0"/>
                                <span>Create & Send via Gmail</span>
                            </AppButton>
                        </div>
                    </div>)}
            </div>);
    };
    const renderLowStockWidget = (msg: Message) => {
        if (!msg.lowStockItems || msg.lowStockItems.length === 0)
            return null;
        const currentRole = user.getRole().toLowerCase();
        const canManagePRs = ['admin', 'executive', 'manager'].includes(currentRole);
        const outOfStockCount = msg.lowStockItems.filter(it => it.current_stock === 0).length;
        const lowStockCount = msg.lowStockItems.filter(it => it.current_stock > 0).length;
        const filteredItems = msg.lowStockItems.filter(it => {
            if (lowStockFilter === 'out_of_stock')
                return it.current_stock === 0;
            if (lowStockFilter === 'low_stock')
                return it.current_stock > 0;
            return true;
        });
        const allFilteredSelected = filteredItems.length > 0 && filteredItems.every(it => selectedLowStockIds.has(it.id));
        return (<div className="mt-3.5 pt-3 border-t border-slate-200/90 dark:border-[#353746] space-y-3">
                {/* Header & Quick Filter Pills */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0"/>
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                Stock Replenishment Items ({msg.lowStockItems.length})
                            </span>
                        </div>

                        {canManagePRs && (<button type="button" onClick={() => {
                    if (allFilteredSelected) {
                        const next = new Set(selectedLowStockIds);
                        filteredItems.forEach(it => next.delete(it.id));
                        setSelectedLowStockIds(next);
                    }
                    else {
                        const next = new Set(selectedLowStockIds);
                        filteredItems.forEach(it => next.add(it.id));
                        setSelectedLowStockIds(next);
                    }
                }} className="text-[11px] font-semibold text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 transition-colors cursor-pointer">
                                {allFilteredSelected ? "Deselect Filtered" : "Select All"}
                            </button>)}
                    </div>

                    {/* Filter Pills */}
                    <div className="flex items-center gap-1.5 text-[10px]">
                        <button type="button" onClick={() => setLowStockFilter('all')} className={`px-2.5 py-1 rounded-full font-semibold transition-all cursor-pointer ${lowStockFilter === 'all'
                ? 'bg-pink-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                            All ({msg.lowStockItems.length})
                        </button>
                        <button type="button" onClick={() => setLowStockFilter('out_of_stock')} className={`px-2.5 py-1 rounded-full font-semibold transition-all cursor-pointer ${lowStockFilter === 'out_of_stock'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                            Out of Stock ({outOfStockCount})
                        </button>
                        <button type="button" onClick={() => setLowStockFilter('low_stock')} className={`px-2.5 py-1 rounded-full font-semibold transition-all cursor-pointer ${lowStockFilter === 'low_stock'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
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
                return (<div key={item.id} onClick={() => {
                        if (!canManagePRs)
                            return;
                        const next = new Set(selectedLowStockIds);
                        if (next.has(item.id))
                            next.delete(item.id);
                        else
                            next.add(item.id);
                        setSelectedLowStockIds(next);
                    }} className={`p-3 rounded-2xl border transition-all ${canManagePRs ? 'cursor-pointer' : ''} ${isSelected
                        ? 'bg-[#ffe6f0] dark:bg-[#341427] border-pink-300 dark:border-[#67224c] shadow-[0_2px_8px_rgba(244,63,94,0.15),inset_0_1px_0_#ffffff] dark:shadow-[0_2px_8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)]'
                        : 'bg-white dark:bg-slate-900/60 border-slate-200/90 dark:border-[#353746] shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0_#ffffff] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-pink-200 dark:hover:border-pink-500/30'}`}>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-start gap-2.5 min-w-0">
                                        {canManagePRs && (<input type="checkbox" checked={isSelected} onChange={() => { }} className="mt-0.5 rounded border-slate-300 text-pink-600 focus:ring-pink-500 shrink-0 cursor-pointer"/>)}
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                                    {item.item_name}
                                                </span>
                                                <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${isOut
                        ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40'
                        : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40'}`}>
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
                                            <button type="button" onClick={() => {
                        setLowStockQuantities(prev => ({
                            ...prev,
                            [item.id]: Math.max(1, currentQty - 5)
                        }));
                    }} className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold transition-colors cursor-pointer">
                                                -
                                            </button>
                                            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 px-1 min-w-[24px] text-center">
                                                {currentQty}
                                            </span>
                                            <button type="button" onClick={() => {
                        setLowStockQuantities(prev => ({
                            ...prev,
                            [item.id]: currentQty + 5
                        }));
                    }} className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold transition-colors cursor-pointer">
                                                +
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            Est: ₱{(currentQty * (item.purchase_price || 100)).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>);
            })}
                </div>

                {/* PR Action Buttons */}
                {canManagePRs ? (<div className="space-y-2 pt-1">
                        {actionFeedback && (<p className="text-xs text-pink-600 dark:text-pink-400 font-medium animate-pulse text-center">
                                {actionFeedback}
                            </p>)}
                        <AppButton type="button" variant="pink" size="sm" pill disabled={selectedLowStockIds.size === 0 || isCreatingPR} onClick={() => handleBatchCreatePRs(msg.id)} className="w-full justify-center text-xs shadow-md">
                            <i className="fas fa-file-invoice text-[11px] shrink-0"/>
                            <span>Create Purchase Request ({selectedLowStockIds.size}) & Notify Admin/Executive</span>
                        </AppButton>
                    </div>) : (<p className="text-[11px] text-slate-400 text-center py-1">
                        🔒 Only Admin, Executive, and Manager can create purchase requests.
                    </p>)}
            </div>);
    };
    const renderCreatedPRsWidget = (msg: Message) => {
        if (!msg.createdPRs || msg.createdPRs.length === 0)
            return null;
        return (<div className="mt-3.5 pt-3 border-t border-slate-200/90 dark:border-[#353746] space-y-2.5">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                        <i className="fas fa-check-circle text-emerald-500"/>
                        Generated Purchase Requests ({msg.createdPRs.length})
                    </span>
                    <Link href="/procurement" onClick={onClose} className="text-[11px] font-semibold text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 flex items-center gap-1">
                        <span>View in Procurement</span>
                        <i className="fas fa-external-link-alt text-[10px]"/>
                    </Link>
                </div>

                <div className="space-y-2">
                    {msg.createdPRs.map((pr: any, idx: number) => (<div key={pr.id || idx} className="p-3 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/90 dark:border-[#353746] shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0_#ffffff] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)] flex items-center justify-between gap-3">
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

                            <Link href={`/procurement?search=${encodeURIComponent(pr.request_number)}`} onClick={onClose} className="shrink-0">
                                <AppButton type="button" variant="pink" size="xs" pill className="text-[11px]">
                                    <span>Filter PR</span>
                                    <i className="fas fa-arrow-right text-[10px] shrink-0"/>
                                </AppButton>
                            </Link>
                        </div>))}
                </div>
            </div>);
    };
    const renderCreatedPOsWidget = (msg: Message) => {
        if (!msg.createdPOs || msg.createdPOs.length === 0)
            return null;
        return (<div className="mt-3.5 pt-3 border-t border-slate-200/90 dark:border-[#353746] space-y-2.5">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                        <i className="fas fa-check-circle text-emerald-500"/>
                        Generated Purchase Orders ({msg.createdPOs.length})
                    </span>
                    <Link href={`/purchase-orders?search=${encodeURIComponent(msg.createdPOs[0]?.po_number || '')}`} onClick={onClose} className="text-[11px] font-semibold text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 flex items-center gap-1">
                        <span>View in PO Page</span>
                        <i className="fas fa-external-link-alt text-[10px]"/>
                    </Link>
                </div>

                <div className="space-y-2">
                    {msg.createdPOs.map((po: any, idx: number) => (<div key={po.id || idx} className="p-3 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/90 dark:border-[#353746] shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0_#ffffff] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)] flex items-center justify-between gap-3">
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

                            <Link href={`/purchase-orders?search=${encodeURIComponent(po.po_number)}`} onClick={onClose} className="shrink-0">
                                <AppButton type="button" variant="pink" size="xs" pill className="text-[11px]">
                                    <span>Filter PO</span>
                                    <i className="fas fa-arrow-right text-[10px] shrink-0"/>
                                </AppButton>
                            </Link>
                        </div>))}
                </div>
            </div>);
    };

    const formatCleanContent = (text: string) => {
        if (!text)
            return '';
        return text
            .replace(/^#{1,6}\s+/gm, '') // Remove ###, ##, # headers
            .replace(/\*\*(.*?)\*\*/g, '$1') // Remove **bold**
            .replace(/\*(.*?)\*/g, '$1') // Remove *italic*
            .replace(/`([^`]+)`/g, '$1') // Remove inline code ticks
            .replace(/###/g, '') // Remove any raw ###
            .replace(/\*\*/g, '') // Remove any raw **
            .trim();
    };

    const renderMatchedDocumentsWidget = (msg: Message) => {
        const docs = msg.matchedDocuments && msg.matchedDocuments.length > 0
            ? msg.matchedDocuments
            : (msg.matchedDocument ? [msg.matchedDocument] : []);

        if (docs.length === 0) return null;

        const activeDocId = previewActiveTab[msg.id] || docs[0].id;
        const currentDoc = docs.find(d => d.id === activeDocId) || docs[0];
        const isImage = Boolean(
            currentDoc.is_gallery ||
            currentDoc.file_type?.startsWith('image/') ||
            currentDoc.storage_path?.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i) ||
            currentDoc.public_url?.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i)
        );

        return (
            <div className="mt-3.5 pt-3 border-t border-slate-200/90 dark:border-[#353746] space-y-3">
                {/* Header with Title and Multiple Match Selector */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <i className="fas fa-check-circle text-emerald-500 text-xs" />
                            <span>System Match Found {docs.length > 1 ? `(${docs.length} records)` : ''}</span>
                        </span>
                    </div>
                    <StatusBadge tone="emerald" size="xs">
                        {currentDoc.target_label || (currentDoc.is_gallery ? 'Media Gallery' : 'Documents')}
                    </StatusBadge>
                </div>

                {/* Multiple Matches Tabs / Selector */}
                {docs.length > 1 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                        {docs.map((doc, idx) => {
                            const isActive = doc.id === currentDoc.id;
                            return (
                                <button
                                    key={doc.id || idx}
                                    type="button"
                                    onClick={() => setPreviewActiveTab(prev => ({ ...prev, [msg.id]: doc.id }))}
                                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                                        isActive
                                            ? 'bg-emerald-600 text-white shadow-xs'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    <i className={`fas ${doc.is_gallery ? 'fa-image' : 'fa-file-alt'} text-[9px]`} />
                                    <span className="truncate max-w-[120px]">{doc.title || doc.file_name}</span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Main Preview Card */}
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/90 border border-emerald-300/80 dark:border-emerald-700/60 shadow-[0_4px_16px_rgba(16,185,129,0.12),inset_0_1px_0_#ffffff] dark:shadow-[0_4px_16px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)] space-y-3">
                    
                    {/* Visual Hero / Document Thumbnail Container */}
                    <div 
                        onClick={(e) => openDocumentPreview(currentDoc, e)}
                        className="group relative rounded-xl overflow-hidden border border-slate-200/80 dark:border-slate-800 bg-[#ebf0f7] dark:bg-[#12131b] shadow-inner cursor-pointer"
                        title="Click to view full preview & zoom"
                    >
                        {(currentDoc.public_url || currentDoc.file_url) && isImage ? (
                            <div className="relative aspect-[16/9] w-full flex items-center justify-center bg-black/10 dark:bg-black/30 overflow-hidden">
                                <OptimizedDocumentPreviewImage
                                    src={currentDoc.public_url || currentDoc.file_url!}
                                    alt={currentDoc.title}
                                    aspectRatio="aspect-[16/9]"
                                    fit="cover"
                                    className="group-hover:scale-105 transition-transform duration-300"
                                />
                                {/* Overlay badge & hover prompt */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent opacity-90 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-xs border border-white/20">
                                            {currentDoc.document_type}
                                        </span>
                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-700/50">
                                            {currentDoc.category}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between text-white text-[11px] font-semibold">
                                        <span className="flex items-center gap-1.5 drop-shadow-sm bg-emerald-600/90 hover:bg-emerald-600 px-2.5 py-1 rounded-full backdrop-blur-xs shadow-xs transition-colors">
                                            <Eye className="w-3.5 h-3.5 text-white" />
                                            <span>Click to preview & zoom</span>
                                        </span>
                                        {currentDoc.file_size && (
                                            <span className="text-[10px] opacity-80 font-mono bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-xs">
                                                {(currentDoc.file_size / 1024).toFixed(1)} KB
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 flex items-center gap-3.5 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-850 dark:to-slate-900 group-hover:from-emerald-50/60 dark:group-hover:from-emerald-950/30 transition-colors">
                                <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800 shadow-xs group-hover:scale-105 transition-transform">
                                    <FileText className="w-6 h-6" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                            {currentDoc.title}
                                        </p>
                                    </div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                        {currentDoc.file_name}
                                    </p>
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                                        <Eye className="w-3 h-3" />
                                        <span>Click to open document previewer</span>
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Match Comparison & Verification Block */}
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-50/90 to-teal-50/70 dark:from-emerald-950/40 dark:to-teal-950/30 border border-emerald-200/90 dark:border-emerald-800/60 space-y-2">
                        <div className="flex items-center justify-between gap-1.5 text-xs">
                            <span className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                                <i className="fas fa-link text-[10px] text-emerald-600 dark:text-emerald-400" />
                                <span>Why this record matched</span>
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 max-w-[190px] truncate">
                                {currentDoc.match_reason || "System Record Match"}
                            </span>
                        </div>

                        {/* File vs Record Comparison */}
                        <div className="grid grid-cols-2 gap-2 text-[10.5px] pt-1.5 border-t border-emerald-200/60 dark:border-emerald-800/50">
                            <div className="p-1.5 rounded-lg bg-white/80 dark:bg-slate-900/60 border border-emerald-100 dark:border-emerald-900/40">
                                <span className="text-[9.5px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 block">Uploaded File</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block mt-0.5" title={msg.attachment?.name || 'Attached file'}>
                                    {msg.attachment?.name || 'Uploaded File'}
                                </span>
                            </div>
                            <div className="p-1.5 rounded-lg bg-white/80 dark:bg-slate-900/60 border border-emerald-100 dark:border-emerald-900/40">
                                <span className="text-[9.5px] uppercase tracking-wider font-bold text-emerald-600 dark:text-emerald-400 block">Database Record</span>
                                <span className="font-semibold text-emerald-900 dark:text-emerald-200 truncate block mt-0.5" title={currentDoc.file_name || currentDoc.title}>
                                    {currentDoc.file_name || currentDoc.title}
                                </span>
                            </div>
                        </div>

                        {/* Matched Criteria Highlights */}
                        {currentDoc.matched_criteria && currentDoc.matched_criteria.length > 0 && (
                            <div className="space-y-1 pt-1">
                                {currentDoc.matched_criteria.map((crit, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-[10px] bg-white/90 dark:bg-slate-900/80 px-2 py-1 rounded-md border border-emerald-100 dark:border-emerald-900/30">
                                        <span className="font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                                            <i className="fas fa-check-circle text-emerald-500 text-[9px]" />
                                            <span>{crit.label}:</span>
                                        </span>
                                        <div className="flex items-center gap-1 font-mono">
                                            <span className="text-slate-600 dark:text-slate-400 truncate max-w-[90px]" title={crit.inserted_value}>
                                                {crit.inserted_value}
                                            </span>
                                            <span className="text-emerald-500 font-bold">⇄</span>
                                            <span className="text-emerald-700 dark:text-emerald-300 font-bold truncate max-w-[90px]" title={crit.matched_value}>
                                                {crit.matched_value}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Metadata Details Grid */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                        <div>
                            <span className="text-slate-400 block text-[10px]">Supplier / Vendor:</span>
                            <strong className="text-slate-800 dark:text-slate-200 truncate block font-semibold">
                                {currentDoc.supplier && currentDoc.supplier !== '—' ? currentDoc.supplier : 'Not specified'}
                            </strong>
                        </div>
                        <div>
                            <span className="text-slate-400 block text-[10px]">Reference / PO #:</span>
                            <div className="flex items-center gap-1 mt-0.5">
                                <strong className="text-slate-800 dark:text-slate-200 font-mono text-[10px] truncate block font-bold">
                                    {currentDoc.po_number && currentDoc.po_number !== '—' ? currentDoc.po_number : 'Not specified'}
                                </strong>
                                {currentDoc.po_number && currentDoc.po_number !== '—' && (
                                    <button
                                        type="button"
                                        onClick={(e) => handleCopyPo(currentDoc.po_number, e)}
                                        className="text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors p-0.5"
                                        title="Copy PO Number"
                                    >
                                        {copiedPoMap[currentDoc.po_number] ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                    </button>
                                )}
                            </div>
                        </div>
                        {currentDoc.notes && (
                            <div className="col-span-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                                <span className="text-slate-400 block text-[10px]">Details:</span>
                                <span className="text-slate-600 dark:text-slate-300 text-[10.5px]">
                                    {currentDoc.notes}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Action Buttons Bar */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={(e) => openDocumentPreview(currentDoc, e)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/80 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-700/60 shadow-xs transition-all active:scale-95 cursor-pointer"
                            >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Preview</span>
                            </button>

                            {(currentDoc.public_url || currentDoc.file_url) && (
                                <button
                                    type="button"
                                    onClick={(e) => handleDownloadFile(currentDoc, e)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs transition-all active:scale-95 cursor-pointer"
                                    title="Download Document"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        <Link
                            href={currentDoc.view_link}
                            onClick={onClose}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-xs transition-all cursor-pointer"
                        >
                            <span>Open in {currentDoc.target_label || (currentDoc.is_gallery ? 'Gallery' : 'Documents')}</span>
                            <ExternalLink className="w-3 h-3" />
                        </Link>
                    </div>
                </div>
            </div>
        );
    };

    const renderMessageContent = (msg: Message) => {
        if (msg.isThinking) {
            return (<div className="flex items-center gap-2">
                    <ThinkingDots />
                    <span className="text-xs text-slate-400">
                        {msg.attachment ? "Analyzing document & checking records..." : "Thinking..."}
                    </span>
                </div>);
        }
        if (msg.content.startsWith('⏳')) {
            return (<div className="flex items-center gap-2">
                    <span className="animate-pulse">⏳</span>
                    <span className="text-sm text-slate-500">{formatCleanContent(msg.content.replace('⏳', ''))}</span>
                </div>);
        }
        return (<div>
                {/* User Attachment Preview - Rendered first in bubble */}
                {msg.attachment && (<div className="mb-2.5">
                        {msg.attachment.type.startsWith('image/') && msg.attachment.dataUrl ? (
                            <div 
                                onClick={() => openDocumentPreview({
                                    id: `uploaded-${msg.id}`,
                                    title: msg.attachment!.name,
                                    file_name: msg.attachment!.name,
                                    category: 'Upload',
                                    document_type: 'Attached Image',
                                    supplier: 'User Upload',
                                    po_number: '—',
                                    uploaded_by: 'You',
                                    created_at: msg.timestamp.toISOString(),
                                    public_url: msg.attachment!.dataUrl,
                                    file_url: msg.attachment!.dataUrl,
                                    file_type: msg.attachment!.type,
                                    file_size: msg.attachment!.size,
                                    is_gallery: true,
                                    view_link: '#',
                                })}
                                className="group relative overflow-hidden rounded-xl border border-white/25 shadow-md bg-black/20 max-w-full cursor-pointer"
                                title="Click to preview & zoom"
                            >
                                <OptimizedDocumentPreviewImage
                                    src={msg.attachment.dataUrl}
                                    alt={msg.attachment.name}
                                    aspectRatio="max-h-48"
                                    fit="contain"
                                    className="rounded-xl group-hover:scale-102 transition-transform"
                                />
                                <div className="p-1.5 bg-black/40 backdrop-blur-xs flex items-center justify-between text-[10px] text-white/90">
                                    <span className="truncate max-w-[200px] font-medium">{msg.attachment.name}</span>
                                    <span className="opacity-75 font-mono">{(msg.attachment.size / 1024).toFixed(1)} KB</span>
                                </div>
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 pointer-events-none">
                                    <span className="px-2.5 py-1 rounded-full bg-black/70 text-white text-[11px] font-semibold flex items-center gap-1.5 backdrop-blur-xs shadow-md">
                                        <Eye className="w-3.5 h-3.5 text-pink-400" /> Click to Preview
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/20 dark:bg-black/40 border border-white/25 backdrop-blur-md text-xs font-semibold">
                                <div className={`w-8 h-8 rounded-lg ${msg.attachment.type.startsWith('image/') ? 'bg-pink-500/80' : 'bg-rose-500/80'} text-white flex items-center justify-center shrink-0`}>
                                    <i className={`fas ${msg.attachment.type.startsWith('image/') ? 'fa-image' : 'fa-file-pdf'} text-sm`}/>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-white text-xs font-medium">{msg.attachment.name}</p>
                                    <p className="text-[10px] text-white/70">{(msg.attachment.size / 1024).toFixed(1)} KB • {msg.attachment.type.startsWith('image/') ? 'Image' : 'Document'}</p>
                                </div>
                            </div>
                        )}
                    </div>)}

                <p className="text-sm whitespace-pre-wrap leading-relaxed">{formatCleanContent(msg.content)}</p>

                {/* System Matched Document(s) Preview Card */}
                {renderMatchedDocumentsWidget(msg)}

                {/* Out of Scope Card */}
                {msg.isOutOfScope && (<div className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
                        <i className="fas fa-info-circle text-amber-600 mt-0.5 shrink-0"/>
                        <div>
                            <p className="font-semibold">Notice: Out-of-Scope Query</p>
                            <p className="text-[11px] opacity-90 mt-0.5">Airship Express AI focuses on Supply Chain operations, document OCR, inventory tracking, and procurement.</p>
                        </div>
                    </div>)}

                {renderPendingRequestsWidget(msg)}
                {renderCreatedPOsWidget(msg)}
                {renderLowStockWidget(msg)}
                {renderCreatedPRsWidget(msg)}
            </div>
        );
    };

    const renderDocumentPreviewModal = () => {
        if (!previewModalDoc) return null;
        const isImage = Boolean(
            previewModalDoc.is_gallery ||
            previewModalDoc.file_type?.startsWith('image/') ||
            previewModalDoc.storage_path?.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i) ||
            previewModalDoc.public_url?.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i)
        );

        return (
            <AnimatePresence>
                {previewModalDoc && (
                    <motion.div
                        key="document-preview-modal-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md select-none"
                        onClick={() => setPreviewModalDoc(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.92, opacity: 0, y: 15 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.92, opacity: 0, y: 15 }}
                            transition={{ type: "spring", stiffness: 320, damping: 26 }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-[#ebf0f7] dark:bg-[#161722] border border-white/90 dark:border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.6)] overflow-hidden"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-5 py-3.5 bg-[#ebf0f7] dark:bg-[#1b1c2a] border-b border-white/80 dark:border-white/[0.08] shrink-0">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                                        previewModalDoc.is_gallery
                                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800'
                                            : 'bg-pink-100 dark:bg-pink-950/80 text-pink-600 dark:text-pink-400 border-pink-300 dark:border-pink-800'
                                    }`}>
                                        <i className={`fas ${previewModalDoc.is_gallery ? 'fa-image' : 'fa-file-alt'} text-sm`} />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                            {previewModalDoc.title || previewModalDoc.file_name}
                                        </h3>
                                        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                            <span>{previewModalDoc.document_type}</span>
                                            <span>•</span>
                                            <span className="font-mono text-[10px]">{previewModalDoc.po_number || previewModalDoc.file_name}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Toolbar Controls */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {isImage && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => setPreviewZoom(prev => Math.max(0.5, prev - 0.25))}
                                                disabled={previewZoom <= 0.5}
                                                className="w-8 h-8 rounded-xl bg-[#ebf0f7] hover:bg-[#e2e9f3] dark:bg-[#202130] dark:hover:bg-[#282a3c] text-slate-600 dark:text-slate-300 border border-white/90 dark:border-white/10 flex items-center justify-center text-xs transition-colors disabled:opacity-40 cursor-pointer shadow-xs"
                                                title="Zoom Out"
                                            >
                                                <ZoomOut className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setPreviewZoom(1)}
                                                className="px-2 h-8 rounded-xl bg-[#ebf0f7] hover:bg-[#e2e9f3] dark:bg-[#202130] dark:hover:bg-[#282a3c] text-slate-600 dark:text-slate-300 border border-white/90 dark:border-white/10 flex items-center justify-center text-[10px] font-bold transition-colors cursor-pointer shadow-xs"
                                                title="Reset Zoom"
                                            >
                                                {Math.round(previewZoom * 100)}%
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setPreviewZoom(prev => Math.min(3, prev + 0.25))}
                                                disabled={previewZoom >= 3}
                                                className="w-8 h-8 rounded-xl bg-[#ebf0f7] hover:bg-[#e2e9f3] dark:bg-[#202130] dark:hover:bg-[#282a3c] text-slate-600 dark:text-slate-300 border border-white/90 dark:border-white/10 flex items-center justify-center text-xs transition-colors disabled:opacity-40 cursor-pointer shadow-xs"
                                                title="Zoom In"
                                            >
                                                <ZoomIn className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setPreviewRotation(prev => (prev + 90) % 360)}
                                                className="w-8 h-8 rounded-xl bg-[#ebf0f7] hover:bg-[#e2e9f3] dark:bg-[#202130] dark:hover:bg-[#282a3c] text-slate-600 dark:text-slate-300 border border-white/90 dark:border-white/10 flex items-center justify-center text-xs transition-colors cursor-pointer shadow-xs"
                                                title="Rotate 90°"
                                            >
                                                <RotateCw className="w-3.5 h-3.5" />
                                            </button>
                                        </>
                                    )}
                                    {(previewModalDoc.public_url || previewModalDoc.file_url) && (
                                        <button
                                            type="button"
                                            onClick={(e) => handleDownloadFile(previewModalDoc, e)}
                                            className="w-8 h-8 rounded-xl bg-[#ebf0f7] hover:bg-[#e2e9f3] dark:bg-[#202130] dark:hover:bg-[#282a3c] text-emerald-600 dark:text-emerald-400 border border-white/90 dark:border-white/10 flex items-center justify-center text-xs transition-colors cursor-pointer shadow-xs"
                                            title="Download File"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setPreviewModalDoc(null)}
                                        className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/80 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 flex items-center justify-center text-xs transition-colors cursor-pointer ml-1"
                                        title="Close Preview"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Body Canvas */}
                            <div className="relative flex-1 min-h-[320px] max-h-[65vh] overflow-auto p-4 flex items-center justify-center bg-slate-900/10 dark:bg-black/40">
                                {(previewModalDoc.public_url || previewModalDoc.file_url) ? (
                                    previewModalDoc.file_type?.includes('pdf') ? (
                                        <iframe
                                            src={previewModalDoc.public_url || previewModalDoc.file_url!}
                                            className="w-full h-[60vh] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner bg-white"
                                            title={previewModalDoc.title}
                                        />
                                    ) : (
                                        <div className="overflow-auto max-w-full max-h-full flex items-center justify-center relative w-full h-full min-h-[300px]">
                                            {/* High-res Loading Spinner */}
                                            {previewModalLoading && (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 backdrop-blur-xs z-10 text-white gap-2 rounded-2xl">
                                                    <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                                                    <span className="text-xs font-semibold tracking-wide">Loading preview...</span>
                                                </div>
                                            )}
                                            <motion.img
                                                src={previewModalDoc.public_url || previewModalDoc.file_url!}
                                                alt={previewModalDoc.title}
                                                decoding="async"
                                                onLoad={() => {
                                                    const url = previewModalDoc.public_url || previewModalDoc.file_url;
                                                    if (url) imageCache.add(url);
                                                    setPreviewModalLoading(false);
                                                }}
                                                onError={() => setPreviewModalLoading(false)}
                                                style={{
                                                    transform: `scale(${previewZoom}) rotate(${previewRotation}deg)`,
                                                    transformOrigin: 'center center',
                                                    willChange: 'transform',
                                                }}
                                                className={`max-h-[58vh] max-w-full object-contain rounded-2xl shadow-xl transition-all duration-200 select-none ${
                                                    previewModalLoading ? 'opacity-0' : 'opacity-100'
                                                }`}
                                            />
                                        </div>
                                    )
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-center p-8 text-slate-400 space-y-3">
                                        <div className="w-16 h-16 rounded-2xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500">
                                            <FileText className="w-8 h-8" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{previewModalDoc.title}</p>
                                            <p className="text-xs text-slate-400 mt-1">Direct file preview is not available for this record type.</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer Strip */}
                            <div className="flex items-center justify-between px-5 py-3 bg-[#ebf0f7] dark:bg-[#1b1c2a] border-t border-white/80 dark:border-white/[0.08] shrink-0 text-xs">
                                <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400 text-[11px] truncate">
                                    <span>Supplier: <strong className="text-slate-700 dark:text-slate-200">{previewModalDoc.supplier}</strong></span>
                                    <span>•</span>
                                    <span>Ref: <strong className="text-slate-700 dark:text-slate-200 font-mono">{previewModalDoc.po_number}</strong></span>
                                </div>

                                <div className="flex items-center gap-2">
                                    {previewModalDoc.view_link && previewModalDoc.view_link !== '#' && (
                                        <Link
                                            href={previewModalDoc.view_link}
                                            onClick={() => {
                                                setPreviewModalDoc(null);
                                                onClose();
                                            }}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all active:scale-95 cursor-pointer"
                                        >
                                            <span>Open in {previewModalDoc.target_label || 'System'}</span>
                                            <ExternalLink className="w-3 h-3" />
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        );
    };

    return (
        <AnimatePresence>
            {!isOpen && (
                <motion.div
                    key="chatbot-floating-robot"
                    id="grabbable-ai-robot"
                    role="button"
                    tabIndex={0}
                    aria-label="Open AI Warehouse Assistant"
                    drag
                    dragConstraints={dragBounds}
                    dragMomentum={true}
                    dragElastic={0.12}
                    dragTransition={{ power: 0.12, timeConstant: 220, bounceStiffness: 280, bounceDamping: 24 }}
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.94 }}
                    whileDrag={{ scale: 1.06 }}
                    onDragStart={handleFloatingDragStart}
                    onDragEnd={handleFloatingDragEnd}
                    onClick={() => {
                        if (hasDraggedRef.current) return;
                        openChat();
                    }}
                    style={{ x: floatX, y: floatY }}
                    initial={{ opacity: 0, scale: 0.85, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.85, y: 10 }}
                    transition={{ type: "spring", stiffness: 320, damping: 28, mass: 0.8 }}
                    className="fixed bottom-20 right-6 z-50 select-none touch-none cursor-grab active:cursor-grabbing group flex items-center justify-center w-12 h-12 rounded-full bg-[#ebf0f7] dark:bg-[#151620] border border-white/90 dark:border-white/[0.08] shadow-[4px_4px_10px_rgba(166,175,195,0.45),-4px_-4px_10px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[5px_5px_15px_rgba(0,0,0,0.75),-2px_-2px_6px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.05)] hover:shadow-[2px_2px_6px_rgba(166,175,195,0.35),-2px_-2px_6px_rgba(255,255,255,0.9)] dark:hover:shadow-[3px_3px_10px_rgba(0,0,0,0.6),-1px_-1px_4px_rgba(255,255,255,0.03)] active:shadow-[inset_2px_2px_4px_rgba(166,175,195,0.4)] dark:active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.8)] transition-shadow duration-200"
                >
                    {/* Reaction Speech Bubble */}
                    <AnimatePresence>
                        {collisionReaction && (
                            <motion.div
                                key="collision-reaction-bubble"
                                initial={{ opacity: 0, y: 8, scale: 0.8 }}
                                animate={{ opacity: 1, y: -10, scale: 1 }}
                                exit={{ opacity: 0, y: -4, scale: 0.8 }}
                                transition={{ duration: 0.22, ease: "easeOut" }}
                                className="absolute -top-9 left-1/2 -translate-x-1/2 pointer-events-none z-30"
                            >
                                <div className="relative px-3 py-1 rounded-xl bg-[#ebf0f7] dark:bg-[#151620] border border-white/90 dark:border-white/[0.08] shadow-[3px_3px_8px_rgba(166,175,195,0.4),-3px_-3px_8px_rgba(255,255,255,0.95)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.6)] text-[11px] font-bold text-pink-600 dark:text-pink-300 whitespace-nowrap flex items-center gap-1">
                                    <span>{collisionReaction}</span>
                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#ebf0f7] dark:bg-[#151620] border-r border-b border-white/90 dark:border-white/[0.08] rotate-45" />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Robot Head with wobble reaction */}
                    <motion.div
                        animate={isWobbling ? {
                            rotate: [-14, 14, -8, 8, -3, 3, 0],
                            scale: [1, 1.22, 0.94, 1.06, 1],
                        } : { rotate: 0, scale: 1 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="pointer-events-none flex items-center justify-center"
                    >
                        <RobotAvatar size={30} isThinking={isLoading} isResponding={isStreaming} />
                    </motion.div>

                    {/* Live Status Dot (Matte, Clean) */}
                    <span className="absolute bottom-0.5 right-0.5 flex h-2.5 w-2.5 items-center justify-center pointer-events-none">
                        <span className={`w-2 h-2 rounded-full border border-[#ebf0f7] dark:border-[#151620] ${isLoading || isStreaming ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                    </span>

                    {/* Unread message badge if there is history */}
                    {messages.length > 1 && (
                        <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-pink-500 text-white text-[9px] font-bold flex items-center justify-center shadow-xs border border-white dark:border-[#151620] pointer-events-none">
                            {messages.length - 1}
                        </span>
                    )}
                </motion.div>
            )}

            {isOpen && (
                <div key="chatbot-drawer-container">
                    {/* Backdrop */}
                    <motion.div
                        key="chatbot-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.22, ease: "easeOut" }}
                        className="fixed inset-0 bg-slate-950/50 dark:bg-slate-950/70 backdrop-blur-[2px] z-40"
                        onClick={onClose}
                    />

                    {/* Chat Drawer with Neumorphic Side Surface (GPU Accelerated & Resizable) */}
                    <motion.div
                        key="chatbot-drawer-panel"
                        data-lenis-prevent
                        initial={{ x: "100%", opacity: 0.8 }}
                        animate={{ x: "0%", opacity: 1 }}
                        exit={{ x: "100%", opacity: 0 }}
                        transition={{
                            duration: 0.26,
                            ease: [0.16, 1, 0.3, 1],
                        }}
                        style={{
                            width: typeof window !== 'undefined' && window.innerWidth >= 640 ? `${drawerWidth}px` : '100%',
                            maxWidth: '100vw',
                        }}
                        className="fixed top-0 right-0 h-full w-full
                                bg-[#ebf0f7] dark:bg-[#15161f] text-slate-900 dark:text-white
                                z-50 flex flex-col font-sans overscroll-contain will-change-transform transform-gpu
                                shadow-[-16px_0_40px_rgba(166,175,195,0.4),inset_1px_0_2px_rgba(255,255,255,0.9)] 
                                dark:shadow-[-16px_0_40px_rgba(0,0,0,0.8),inset_1px_0_1px_rgba(255,255,255,0.05)]
                                border-l border-white/80 dark:border-white/[0.08]"
                    >
                        {/* Left Edge Resize Drag Handle */}
                        <div
                            onMouseDown={handleResizeStart}
                            onDoubleClick={toggleWidthExpand}
                            className={`hidden sm:flex absolute -left-1.5 top-0 bottom-0 w-3 z-30 cursor-ew-resize items-center justify-center group touch-none select-none`}
                            title="Drag left or right to resize (Double-click to expand/reset)"
                        >
                            {/* Visual line */}
                            <div className={`h-full w-1 transition-all duration-150 rounded-full ${
                                isResizing 
                                    ? 'bg-pink-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]' 
                                    : 'bg-transparent group-hover:bg-pink-400/60 dark:group-hover:bg-pink-500/50'
                            }`} />
                            {/* Grip Indicator Handle */}
                            <div className={`absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-4 h-12 rounded-full flex flex-col items-center justify-center gap-1 transition-all duration-150 shadow-md border ${
                                isResizing 
                                    ? 'bg-pink-500 text-white border-pink-400 scale-110' 
                                    : 'bg-[#ebf0f7] dark:bg-[#1e1f2c] border-white/90 dark:border-white/10 text-slate-400 group-hover:text-pink-600 dark:group-hover:text-pink-400 group-hover:scale-105 opacity-0 group-hover:opacity-100'
                            }`}>
                                <div className="w-1 h-1 rounded-full bg-current" />
                                <div className="w-1 h-1 rounded-full bg-current" />
                                <div className="w-1 h-1 rounded-full bg-current" />
                            </div>
                        </div>

                        {/* Header with Robot & Neumorphic Header Surface */}
                        <div className="bg-[#ebf0f7] dark:bg-[#181924] px-5 py-4 flex items-center justify-between shrink-0 shadow-[0_4px_12px_rgba(166,175,195,0.35),inset_0_1px_1.5px_rgba(255,255,255,0.95)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.06)] z-10 border-b border-white/80 dark:border-white/[0.06] transition-colors">
                            {/* Left: Assistant Status & Avatar */}
                            <div className="flex items-center gap-3.5">
                                <div className="relative flex items-center justify-center p-1.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#1e1f2c] border border-white/90 dark:border-white/[0.08] shadow-[3px_3px_6px_rgba(166,175,195,0.4),-3px_-3px_6px_rgba(255,255,255,0.95)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.5),-1px_-1px_3px_rgba(255,255,255,0.04)]">
                                    <RobotHeader size={36} isThinking={isRobotThinking} isResponding={isRobotResponding}/>

                                    {/* Live Indicator Badge (Clean Matte, No Glow) */}
                                    <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center">
                                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 border-2 border-[#ebf0f7] dark:border-[#1e1f2c] ${isStreaming || isLoading
                    ? "bg-amber-400"
                    : "bg-emerald-500"}`}/>
                                    </span>
                                </div>

                                <div>
                                    <h2 className="text-slate-800 dark:text-slate-100 font-bold text-sm tracking-tight leading-snug">
                                        AI Warehouse Assistant
                                    </h2>
                                    <p className="text-pink-600 dark:text-pink-400 text-[11px] font-semibold tracking-wide flex items-center gap-1.5 mt-0.5">
                                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${isStreaming || isLoading ? 'bg-amber-400' : 'bg-emerald-500'}`}/>
                                        {isStreaming
                    ? "Typing response..."
                    : isLoading
                        ? "Processing..."
                        : "Online & Ready"}
                                    </p>
                                </div>
                            </div>

                            {/* Right: Neumorphic Controls */}
                            <div className="flex items-center gap-2">
                                {/* Expand / Reset Width Button */}
                                <button
                                    type="button"
                                    onClick={toggleWidthExpand}
                                    className="text-slate-600 hover:text-pink-600 dark:text-slate-300 dark:hover:text-pink-400 p-2.5 rounded-full bg-[#ebf0f7] dark:bg-[#1c1d29] border border-white/90 dark:border-white/[0.08] shadow-[3px_3px_6px_rgba(166,175,195,0.4),-3px_-3px_6px_rgba(255,255,255,0.95)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.5),-1px_-1px_3px_rgba(255,255,255,0.05)] hover:shadow-[1px_1px_3px_rgba(166,175,195,0.4),-1px_-1px_3px_rgba(255,255,255,0.9)] active:shadow-[inset_2px_2px_4px_rgba(166,175,195,0.45)] transition-all duration-150 active:scale-95 cursor-pointer hidden sm:flex items-center justify-center w-8 h-8"
                                    title={drawerWidth > 560 ? "Reset width (440px)" : "Expand width"}
                                    aria-label="Toggle drawer width"
                                >
                                    {drawerWidth > 560 ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                                </button>

                                <button onClick={onClose} className="text-slate-600 hover:text-pink-600 dark:text-slate-300 dark:hover:text-pink-400 p-2.5 rounded-full bg-[#ebf0f7] dark:bg-[#1c1d29] border border-white/90 dark:border-white/[0.08] shadow-[3px_3px_6px_rgba(166,175,195,0.4),-3px_-3px_6px_rgba(255,255,255,0.95)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.5),-1px_-1px_3px_rgba(255,255,255,0.05)] hover:shadow-[1px_1px_3px_rgba(166,175,195,0.4),-1px_-1px_3px_rgba(255,255,255,0.9)] active:shadow-[inset_2px_2px_4px_rgba(166,175,195,0.45)] transition-all duration-150 active:scale-95 cursor-pointer flex items-center justify-center w-8 h-8" title="Minimize chat" aria-label="Minimize assistant drawer">
                                    <Minus className="w-3.5 h-3.5"/>
                                </button>

                                {messages.length > 1 && (<button onClick={() => {
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
                    }} className="text-slate-600 hover:text-rose-600 dark:text-slate-300 dark:hover:text-rose-400 p-2.5 rounded-full bg-[#ebf0f7] dark:bg-[#1c1d29] border border-white/90 dark:border-white/[0.08] shadow-[3px_3px_6px_rgba(166,175,195,0.4),-3px_-3px_6px_rgba(255,255,255,0.95)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.5),-1px_-1px_3px_rgba(255,255,255,0.05)] hover:shadow-[1px_1px_3px_rgba(166,175,195,0.4),-1px_-1px_3px_rgba(255,255,255,0.9)] active:shadow-[inset_2px_2px_4px_rgba(166,175,195,0.45)] transition-all duration-150 active:scale-95 cursor-pointer flex items-center justify-center w-8 h-8" title="Clear chat" aria-label="Clear chat history">
                                        <i className="fas fa-trash-alt text-[11px]"/>
                                    </button>)}

                                <button onClick={onClose} className="text-slate-600 hover:text-rose-600 dark:text-slate-300 dark:hover:text-rose-400 p-2.5 rounded-full bg-[#ebf0f7] dark:bg-[#1c1d29] border border-white/90 dark:border-white/[0.08] shadow-[3px_3px_6px_rgba(166,175,195,0.4),-3px_-3px_6px_rgba(255,255,255,0.95)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.5),-1px_-1px_3px_rgba(255,255,255,0.05)] hover:shadow-[1px_1px_3px_rgba(166,175,195,0.4),-1px_-1px_3px_rgba(255,255,255,0.9)] active:shadow-[inset_2px_2px_4px_rgba(166,175,195,0.45)] transition-all duration-150 active:scale-95 cursor-pointer flex items-center justify-center w-8 h-8" title="Close drawer" aria-label="Close assistant drawer">
                                    <X className="w-3.5 h-3.5"/>
                                </button>
                            </div>
                        </div>

                        {/* Messages Body */}
                        <div className="relative flex-1 overflow-hidden bg-[#e8eef6]/40 dark:bg-[#12131b]/40 shadow-[inset_0_2px_6px_rgba(166,175,195,0.2)] dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.4)]">
                            <div ref={messagesContainerRef} data-lenis-prevent className="h-full overflow-y-auto overscroll-contain p-5 space-y-5 scroll-smooth scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700" onScroll={checkIfAtBottom}>
                                {messages.map((msg) => (<div key={msg.id} className={`flex items-start gap-3 ${msg.type === "user" ? "flex-row-reverse" : ""}`}>
                                        {/* Avatar handling */}
                                        {msg.type === "user" ? (<div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-[3px_3px_6px_rgba(244,63,94,0.35),-2px_-2px_4px_rgba(255,255,255,0.4),inset_0_1px_1px_rgba(255,255,255,0.4)] bg-gradient-to-tr from-pink-600 to-rose-500 text-white border border-pink-400/40">
                                                <i className="fas fa-user text-xs"/>
                                            </div>) : (<div className="p-1 rounded-full bg-[#ebf0f7] dark:bg-[#1e1f2c] border border-white/90 dark:border-white/[0.08] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_6px_rgba(0,0,0,0.5),-1px_-1px_3px_rgba(255,255,255,0.04)] shrink-0">
                                                <RobotAvatar size={28} isThinking={msg.isThinking} isResponding={!msg.isThinking && msg.content?.length > 0}/>
                                            </div>)}

                                        <div className={`max-w-[84%] space-y-1.5 ${msg.type === "user" ? "items-end" : "items-start"}`}>
                                            {/* Message Bubble */}
                                            <div className={`rounded-2xl px-4 py-3.5 text-sm leading-relaxed transition-colors ${msg.type === "user"
                        ? "bg-gradient-to-br from-pink-500 to-rose-600 text-white rounded-tr-xs font-normal shadow-[4px_4px_12px_rgba(244,63,94,0.35),-2px_-2px_6px_rgba(255,255,255,0.4),inset_0_1px_1.5px_rgba(255,255,255,0.4)] border border-pink-400/40"
                        : "bg-[#ebf0f7] dark:bg-[#1a1b26] text-slate-800 dark:text-slate-100 border border-white/90 dark:border-white/[0.08] rounded-tl-xs font-normal shadow-[4px_4px_10px_rgba(166,175,195,0.35),-4px_-4px_10px_rgba(255,255,255,0.95),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[4px_4px_12px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.05)]"}`}>
                                                {renderMessageContent(msg)}
                                            </div>

                                            {/* Timestamp */}
                                            <div className={`flex items-center gap-2 px-1 ${msg.type === "user" ? "justify-end" : "justify-start"}`}>
                                                {msg.content && !msg.isThinking && (<span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                                                        {formatTime(msg.timestamp)}
                                                    </span>)}
                                            </div>

                                            {/* Suggestions */}
                                            {msg.suggestions && msg.suggestions.length > 0 && msg.type === "assistant" && (<div className="pt-2 space-y-2">
                                                    <span className="text-[11px] font-bold text-pink-600 dark:text-pink-400 flex items-center gap-1.5">
                                                        <i className="fas fa-lightbulb text-amber-500 text-[10px]"/>
                                                        Follow-up ideas
                                                    </span>
                                                    <div className="flex flex-wrap gap-2">
                                                        {msg.suggestions.slice(0, 3).map((suggestion) => (<button key={suggestion} onClick={() => {
                                setInput(suggestion);
                                setTimeout(() => handleSendMessage(), 100);
                            }} className="text-xs font-semibold bg-[#ebf0f7] hover:bg-[#e4ebf5] text-pink-700 dark:bg-[#1e1f2c] dark:hover:bg-[#252636] dark:text-pink-300 border border-white/90 dark:border-white/[0.08] shadow-[3px_3px_6px_rgba(166,175,195,0.35),-3px_-3px_6px_rgba(255,255,255,0.95)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.5),-1px_-1px_3px_rgba(255,255,255,0.04)] hover:shadow-[1px_1px_3px_rgba(166,175,195,0.4),-1px_-1px_3px_rgba(255,255,255,0.9)] active:shadow-[inset_2px_2px_4px_rgba(166,175,195,0.45)] px-3.5 py-1.5 rounded-full transition-all duration-150 active:scale-95 text-left cursor-pointer">
                                                                {suggestion}
                                                            </button>))}
                                                    </div>
                                                </div>)}
                                        </div>
                                    </div>))}

                                {/* Loading Indicator */}
                                {isLoading && messages[messages.length - 1]?.content && !isStreaming && (<div className="flex items-center gap-2 text-xs font-semibold text-pink-600 dark:text-pink-400 bg-[#ebf0f7] dark:bg-[#1a1b26] border border-white/90 dark:border-white/[0.08] shadow-[3px_3px_6px_rgba(166,175,195,0.35),-3px_-3px_6px_rgba(255,255,255,0.95)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.5),-1px_-1px_3px_rgba(255,255,255,0.04)] px-3.5 py-1.5 rounded-full w-fit">
                                        <i className="fas fa-circle-notch fa-spin text-xs"/>
                                        <span>Thinking...</span>
                                    </div>)}
                                <div ref={messagesEndRef}/>
                            </div>

                            {/* Floating Scroll-to-Bottom Button */}
                            {showScrollButton && (<button onClick={scrollToBottom} className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#ebf0f7] hover:bg-[#e4ebf5] text-pink-600 dark:bg-[#1e1f2c] dark:hover:bg-[#252636] dark:text-pink-300 border border-white/90 dark:border-white/[0.08] shadow-[4px_4px_10px_rgba(166,175,195,0.4),-4px_-4px_10px_rgba(255,255,255,0.95)] dark:shadow-[4px_4px_12px_rgba(0,0,0,0.6),-2px_-2px_6px_rgba(255,255,255,0.04)] active:shadow-[inset_2px_2px_4px_rgba(166,175,195,0.45)] rounded-full p-2.5 transition-all duration-150 hover:scale-105 active:scale-95 z-10 cursor-pointer" aria-label="Scroll to bottom">
                                    <i className="fas fa-arrow-down text-xs"/>
                                    <span className="sr-only">Scroll to bottom</span>
                                </button>)}
                        </div>

                        {/* Quick Prompts */}
                        {messages.length < 3 && (<div className="px-5 py-3.5 border-t border-white/80 dark:border-white/[0.06] bg-[#ebf0f7] dark:bg-[#181924] shadow-[0_-2px_6px_rgba(166,175,195,0.15)] shrink-0 transition-colors">
                                {/* Header */}
                                <p className="text-[11px] font-bold text-pink-600 dark:text-pink-400 mb-2.5 flex items-center gap-1.5 uppercase tracking-wider">
                                    <Sparkles className="w-3.5 h-3.5 text-pink-500 dark:text-pink-400 inline-block"/>
                                    <span>Quick Prompts</span>
                                </p>

                                {/* Prompt Buttons Container */}
                                <div className="flex flex-wrap gap-2">
                                    {SUGGESTED_QUESTIONS.map((q) => (<button key={q} onClick={() => handleSuggested(q)} disabled={isLoading || (isLockedOut && lockoutSeconds > 0)} className="text-xs font-semibold bg-[#ebf0f7] hover:bg-[#e4ebf5] text-slate-700 hover:text-pink-600 dark:bg-[#1e1f2c] dark:hover:bg-[#252636] dark:text-slate-200 dark:hover:text-pink-300 border border-white/90 dark:border-white/[0.08] shadow-[3px_3px_6px_rgba(166,175,195,0.35),-3px_-3px_6px_rgba(255,255,255,0.95)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.5),-1px_-1px_3px_rgba(255,255,255,0.04)] hover:shadow-[1px_1px_3px_rgba(166,175,195,0.4),-1px_-1px_3px_rgba(255,255,255,0.9)] active:shadow-[inset_2px_2px_4px_rgba(166,175,195,0.45)] px-3.5 py-1.5 rounded-full transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 cursor-pointer">
                                            {q}
                                        </button>))}
                                </div>
                            </div>)}

                        {/* Input Area */}
                        <div className="p-4 border-t border-white/80 dark:border-white/[0.06] bg-[#ebf0f7] dark:bg-[#181924] shadow-[0_-4px_14px_rgba(166,175,195,0.25),inset_0_1px_1px_rgba(255,255,255,0.95)] dark:shadow-[0_-4px_14px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.05)] shrink-0 transition-all">
                            
                            {/* Moderation Lockout Banner */}
                            {isLockedOut && lockoutSeconds > 0 && (
                                <div className="mb-2.5 p-3 rounded-2xl bg-rose-50 dark:bg-[#2b1419] border border-rose-200 dark:border-rose-900/60 flex items-center justify-between gap-2.5 text-xs text-rose-700 dark:text-rose-300 animate-in fade-in duration-200 shadow-2xs">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
                                        <span className="font-medium truncate">
                                            AI Chatbot queries locked for policy violations
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0 font-bold bg-rose-100 dark:bg-rose-950/80 px-2.5 py-1 rounded-full text-rose-800 dark:text-rose-200 text-[11px] border border-rose-200/80 dark:border-rose-800">
                                        <Clock className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                                        <span>
                                            {Math.floor(lockoutSeconds / 60)}m {String(lockoutSeconds % 60).padStart(2, '0')}s
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Mode Switcher Segmented Control */}
                            <div className="mb-3 p-1 rounded-2xl bg-[#e2e9f3] dark:bg-[#11121a] border border-white/60 dark:border-white/[0.04] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),inset_-1px_-1px_2px_rgba(255,255,255,0.02)] flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => handleModeSwitch('chat')}
                                    disabled={isLoading || (isLockedOut && lockoutSeconds > 0)}
                                    className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                                        activeMode === 'chat'
                                            ? 'bg-[#ebf0f7] dark:bg-[#1e1f2c] text-pink-600 dark:text-pink-400 border border-white/90 dark:border-white/[0.08] shadow-[3px_3px_6px_rgba(166,175,195,0.35),-3px_-3px_6px_rgba(255,255,255,0.95)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.5),-1px_-1px_3px_rgba(255,255,255,0.04)]'
                                            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                                    }`}
                                >
                                    <i className="fas fa-comments text-xs" />
                                    <span>AI Chat</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleModeSwitch('search')}
                                    disabled={isLoading || (isLockedOut && lockoutSeconds > 0)}
                                    className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                                        activeMode === 'search'
                                            ? 'bg-emerald-500/15 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-700/60 shadow-[3px_3px_6px_rgba(16,185,129,0.2),-2px_-2px_4px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.5),-1px_-1px_3px_rgba(255,255,255,0.04)]'
                                            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                                    }`}
                                >
                                    <i className="fas fa-camera text-xs" />
                                    <span>Search Document with Photo</span>
                                </button>
                            </div>

                            {/* Attachment Preview Chip */}
                            {attachedFile && (
                                <div className={`mb-2 p-2 px-3.5 rounded-2xl border transition-all animate-in fade-in zoom-in-95 duration-150 flex items-center justify-between gap-2 text-xs ${
                                    attachedFile.mode === 'search_document'
                                        ? 'bg-emerald-50/90 dark:bg-[#122b22] border-emerald-300 dark:border-emerald-700/60 shadow-[3px_3px_8px_rgba(16,185,129,0.15)]'
                                        : 'bg-[#ebf0f7] dark:bg-[#1c1d28] border-white/90 dark:border-white/[0.08] shadow-[3px_3px_6px_rgba(166,175,195,0.35),-3px_-3px_6px_rgba(255,255,255,0.95)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.5),-1px_-1px_3px_rgba(255,255,255,0.04)]'
                                }`}>
                                    <div className="flex items-center gap-2 min-w-0">
                                        {attachedFile.type.startsWith('image/') ? (
                                            <img src={attachedFile.dataUrl} alt="Preview" className={`w-8 h-8 rounded-lg object-cover border shrink-0 ${attachedFile.mode === 'search_document' ? 'border-emerald-400 dark:border-emerald-600' : 'border-pink-300 dark:border-pink-800'}`} />
                                        ) : (
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${attachedFile.mode === 'search_document' ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400' : 'bg-pink-100 dark:bg-pink-950/80 text-pink-600 dark:text-pink-400'}`}>
                                                <i className={`fas ${attachedFile.mode === 'search_document' ? 'fa-search-plus' : 'fa-file-pdf'} text-sm`} />
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <p className="text-xs font-semibold text-slate-800 dark:text-white truncate">
                                                    {attachedFile.name}
                                                </p>
                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                                    attachedFile.mode === 'search_document'
                                                        ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                                                        : 'bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800'
                                                }`}>
                                                    {attachedFile.mode === 'search_document' ? '🔍 Search Document' : '📎 Chat Attachment'}
                                                </span>
                                            </div>
                                            <p className={`text-[10px] ${attachedFile.mode === 'search_document' ? 'text-emerald-600 dark:text-emerald-400' : 'text-pink-600 dark:text-pink-400'}`}>
                                                {(attachedFile.size / 1024).toFixed(1)} KB • {attachedFile.mode === 'search_document' ? 'Will OCR & match in system database' : 'Normal chat • Describe / answer questions'}
                                            </p>
                                        </div>
                                    </div>
                                    <button type="button" onClick={handleRemoveAttachment} className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-full transition-colors cursor-pointer" title="Remove attachment">
                                        <i className="fas fa-times text-xs" />
                                    </button>
                                </div>
                            )}

                            <div className="relative flex items-center gap-2">
                                {/* Hidden file inputs */}
                                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/csv" onChange={handleFileSelect} className="hidden" />
                                <input ref={searchFileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" onChange={handleSearchFileSelect} className="hidden" />

                                {activeMode === 'search' ? (
                                    /* Search Mode Photo Picker Button */
                                    <button
                                        type="button"
                                        onClick={() => searchFileInputRef.current?.click()}
                                        disabled={isLoading || (isLockedOut && lockoutSeconds > 0)}
                                        className="p-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-[#153326] dark:hover:bg-[#1a3d2e] dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-700/60 shadow-[3px_3px_6px_rgba(16,185,129,0.25),-2px_-2px_4px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.5),-1px_-1px_3px_rgba(255,255,255,0.04)] active:shadow-[inset_2px_2px_4px_rgba(16,185,129,0.4)] transition-all duration-150 shrink-0 cursor-pointer disabled:opacity-50 flex items-center justify-center"
                                        title="Select Photo/Document to Search"
                                        aria-label="Select photo or document to search"
                                    >
                                        <i className="fas fa-camera text-sm" />
                                    </button>
                                ) : (
                                    /* Normal Chat Attachment Button */
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isLoading || (isLockedOut && lockoutSeconds > 0)}
                                        className="p-3 rounded-2xl bg-[#ebf0f7] hover:bg-[#e4ebf5] text-slate-600 hover:text-pink-600 dark:bg-[#1e1f2c] dark:hover:bg-[#252636] dark:text-slate-300 dark:hover:text-pink-400 border border-white/90 dark:border-white/[0.08] shadow-[3px_3px_6px_rgba(166,175,195,0.35),-3px_-3px_6px_rgba(255,255,255,0.95)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.5),-1px_-1px_3px_rgba(255,255,255,0.04)] active:shadow-[inset_2px_2px_4px_rgba(166,175,195,0.45)] transition-all duration-150 shrink-0 cursor-pointer disabled:opacity-50"
                                        title="Attach picture or document (normal chat)"
                                        aria-label="Attach picture or document"
                                    >
                                        <i className="fas fa-paperclip text-sm" />
                                    </button>
                                )}

                                <div className="relative flex-1 flex items-center">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        disabled={activeMode === 'search' || isLoading || (isLockedOut && lockoutSeconds > 0)}
                                        placeholder={
                                            isLockedOut && lockoutSeconds > 0
                                                ? "Queries temporarily locked (cooling down...)"
                                                : activeMode === 'search'
                                                ? (attachedFile
                                                    ? `Photo attached: ${attachedFile.name} (Click search button)`
                                                    : "Input disabled in Search Mode — upload photo/receipt above")
                                                : (attachedFile
                                                    ? "Ask anything about this file (or press enter)..."
                                                    : "Ask about inventory, stock, or attach docs...")
                                        }
                                        className={`w-full text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-white/60 dark:border-white/[0.04] shadow-[inset_3px_3px_6px_rgba(166,175,195,0.45),inset_-3px_-3px_6px_rgba(255,255,255,0.95)] dark:shadow-[inset_3px_3px_7px_rgba(0,0,0,0.65),inset_-1px_-1px_3px_rgba(255,255,255,0.03)] focus:outline-none focus:border-pink-400 dark:focus:border-pink-500/70 rounded-2xl pl-4 pr-12 py-3.5 text-sm transition-all duration-150 ${
                                            activeMode === 'search'
                                                ? 'bg-[#dbe3ef]/60 dark:bg-[#0c0d14]/70 cursor-not-allowed opacity-75 font-medium italic'
                                                : 'bg-[#e2e9f3] dark:bg-[#11121a] disabled:opacity-60 disabled:cursor-not-allowed'
                                        }`}
                                    />

                                    <button
                                        onClick={() => handleSendMessage()}
                                        disabled={
                                            activeMode === 'search'
                                                ? (!attachedFile || isLoading || (isLockedOut && lockoutSeconds > 0))
                                                : ((!input.trim() && !attachedFile) || isLoading || (isLockedOut && lockoutSeconds > 0))
                                        }
                                        aria-label={activeMode === 'search' ? "Search Database with Photo" : "Send message"}
                                        className={`absolute right-2 w-8 h-8 rounded-full text-white disabled:opacity-40 disabled:cursor-not-allowed border flex items-center justify-center transition-all duration-150 active:scale-95 cursor-pointer ${
                                            activeMode === 'search'
                                                ? 'bg-gradient-to-tr from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-[3px_3px_6px_rgba(16,185,129,0.4),-1px_-1px_3px_rgba(255,255,255,0.4)] border-emerald-400/40'
                                                : 'bg-gradient-to-tr from-pink-500 to-rose-600 hover:from-pink-500 hover:to-rose-700 shadow-[3px_3px_6px_rgba(244,63,94,0.4),-1px_-1px_3px_rgba(255,255,255,0.4)] border-pink-400/40'
                                        }`}
                                    >
                                        <i className={`fas ${isLoading ? 'fa-spinner fa-spin' : activeMode === 'search' ? 'fa-search' : 'fa-arrow-up'} text-xs`} />
                                    </button>
                                </div>
                            </div>

                            <div className="mt-2.5 flex items-center justify-between px-1">
                                <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                                    {isLoading ? (<>
                                            <span className="w-1.5 h-1.5 rounded-full bg-pink-500"/>
                                            <span>Processing request...</span>
                                        </>) : isLockedOut && lockoutSeconds > 0 ? (
                                        <span className="text-rose-500 font-semibold flex items-center gap-1">
                                            <ShieldAlert className="w-3 h-3" />
                                            <span>Account cooling down ({lockoutSeconds}s)</span>
                                        </span>
                                    ) : activeMode === 'search' ? (
                                        <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                                            <i className="fas fa-camera text-[10px]" />
                                            <span>Upload photo or receipt to match in database</span>
                                        </span>
                                    ) : (
                                        <span>Press <kbd className="px-1.5 py-0.5 rounded text-[9px] bg-[#e2e9f3] dark:bg-[#11121a] text-slate-600 dark:text-slate-400 border border-white/60 dark:border-white/[0.04] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3)] font-mono">Enter</kbd> to send</span>
                                    )}
                                </span>

                                <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                                    activeMode === 'search'
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-pink-600 dark:text-pink-400'
                                }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${activeMode === 'search' ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-pink-500 dark:bg-pink-400'}`}/>
                                    {activeMode === 'search' ? 'Document Matcher' : 'Warehouse AI'}
                                </span>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
            {renderDocumentPreviewModal()}
        </AnimatePresence>
    );
}
