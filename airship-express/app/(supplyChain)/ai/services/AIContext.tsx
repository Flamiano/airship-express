// app/components/ai/AIContext.tsx

'use client'

import React, { createContext, useContext, useState, useRef } from 'react';

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
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export const AIProvider = ({ children }: { children: React.ReactNode }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [question, setQuestion] = useState('');
    const [isRobotThinking, setRobotThinking] = useState(false);
    const [isRobotResponding, setRobotResponding] = useState(false);
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