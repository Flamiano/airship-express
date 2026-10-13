// app/components/ai/AIContext.tsx

'use client'

import React, { createContext, useContext, useState, useRef } from 'react';

export interface AIBestOfferRecommendation {
    id: string | number;
    requestNumber: string;
    itemName: string;
    supplierName: string;
    supplierId?: string | number;
    totalAmount: number;
    unitPrice: number;
    unit?: string;
    leadTimeDays: number;
    availability: string;
    overallScore?: number;
    summary?: string;
    strengths?: string[];
    comparisonQuotes?: Array<{
        supplierName: string;
        totalAmount: number;
        leadTimeDays: number;
    }>;
}

interface AIContextType {
    isOpen: boolean;
    question: string;
    openChat: (question?: string) => void;
    closeChat: () => void;
    setQuestion: (question: string) => void;
    sendQuestion: () => void;
    isRobotThinking: boolean;
    isRobotResponding: boolean;
    setRobotThinking: (value: boolean) => void;
    setRobotResponding: (value: boolean) => void;
    activeRecommendation: AIBestOfferRecommendation | null;
    setActiveRecommendation: (rec: AIBestOfferRecommendation | null) => void;
    openRecommendationChat: (rec?: AIBestOfferRecommendation) => void;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export const AIProvider = ({ children }: { children: React.ReactNode }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [question, setQuestion] = useState('');
    const [isRobotThinking, setRobotThinking] = useState(false);
    const [isRobotResponding, setRobotResponding] = useState(false);
    const [activeRecommendation, setActiveRecommendation] = useState<AIBestOfferRecommendation | null>(null);
    const sendQuestionRef = useRef<(() => void) | null>(null);

    const openChat = (q?: string) => {
        if (q) {
            setQuestion(q);
        }
        setIsOpen(true);
        // Reset robot states when opening
        setRobotThinking(false);
        setRobotResponding(false);
    };

    const openRecommendationChat = (rec?: AIBestOfferRecommendation) => {
        const targetRec = rec || activeRecommendation;
        if (targetRec) {
            if (rec) setActiveRecommendation(rec);
            const q = `Provide a full AI recommendation analysis and comparison for the best offer on ${targetRec.itemName} (${targetRec.requestNumber}) from ${targetRec.supplierName}.`;
            setQuestion(q);
        }
        setIsOpen(true);
        setRobotThinking(false);
        setRobotResponding(true);
    };

    const closeChat = () => {
        setIsOpen(false);
        setQuestion('');
        setRobotThinking(false);
        setRobotResponding(false);
    };

    const sendQuestion = () => {
        if (sendQuestionRef.current) {
            sendQuestionRef.current();
        }
    };

    return (
        <AIContext.Provider value={{
            isOpen,
            question,
            openChat,
            closeChat,
            setQuestion,
            sendQuestion,
            isRobotThinking,
            isRobotResponding,
            setRobotThinking,
            setRobotResponding,
            activeRecommendation,
            setActiveRecommendation,
            openRecommendationChat,
        }}>
            {children}
        </AIContext.Provider>
    );
};

export const useAI = () => {
    const context = useContext(AIContext);
    if (!context) {
        throw new Error('useAI must be used within an AIProvider');
    }
    return context;
};