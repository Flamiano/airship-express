// app/components/ai/components/InteractiveMessage.tsx

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

interface InteractiveMessageProps {
    message: string;
    type?: 'greeting' | 'thinking' | 'response';
    duration?: number;
    onComplete?: () => void;
}

const TYPING_SPEED = 30; // ms per character

export function InteractiveMessage({
    message,
    type = 'greeting',
    duration = 3000,
    onComplete
}: InteractiveMessageProps) {
    const [displayText, setDisplayText] = useState('');
    const [isTyping, setIsTyping] = useState(true);
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        let index = 0;
        const timer = setInterval(() => {
            if (index < message.length) {
                setDisplayText(prev => prev + message[index]);
                index++;
            } else {
                setIsTyping(false);
                clearInterval(timer);

                // Auto-hide after duration
                setTimeout(() => {
                    setIsVisible(false);
                    if (onComplete) onComplete();
                }, duration);
            }
        }, TYPING_SPEED);

        return () => clearInterval(timer);
    }, [message, duration, onComplete]);

    const getColors = () => {
        switch (type) {
            case 'thinking':
                return 'bg-amber-50 border-amber-200 text-amber-800';
            case 'response':
                return 'bg-emerald-50 border-emerald-200 text-emerald-800';
            default:
                return 'bg-pink-50 border-pink-200 text-pink-800';
        }
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    className={`rounded-2xl px-4 py-2.5 shadow-lg border max-w-[280px] ${getColors()}`}
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.9 }}
                    transition={{ duration: 0.3 }}
                >
                    <p className="text-sm font-medium">
                        {displayText}
                        {isTyping && (
                            <span className="inline-block ml-0.5 w-1.5 h-4 bg-current animate-pulse" />
                        )}
                    </p>
                    {type === 'thinking' && (
                        <div className="flex gap-1 mt-1">
                            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}