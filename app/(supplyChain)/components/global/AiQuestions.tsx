'use client'

import React from 'react'
import { useAI } from '../../ai/services/AIContext';

interface Question {
    question: string;
    color?: string;
}

interface AiQuestionsProps {
    questions?: Question[];
    title?: string;
    subtitle?: string;
    className?: string;
    gridCols?: string;
    onQuestionClick?: (question: string) => void;
}

const defaultQuestions: Question[] = [
    {
        question: "How many parcels today?",
        color: "bg-pink-500"
    },
    {
        question: "Show me yesterday's total parcels",
        color: "bg-pink-400"
    },
    {
        question: "Best courier performance?",
        color: "bg-pink-300"
    },
    {
        question: "Summary of operations",
        color: "bg-pink-200"
    }
];

const AiQuestions = ({
    questions = defaultQuestions,
    title = "AI Suggested Questions",
    subtitle = "Click to ask",
    className = "",
    gridCols = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
    onQuestionClick
}: AiQuestionsProps) => {
    const { openChat } = useAI();

    const QuestionButton = ({ question, color = "bg-pink-400" }: Question) => (
        <button
            className="ai-question-btn flex items-center gap-2 p-4 rounded-lg 
            border border-slate-200 dark:border-slate-700/60 
            hover:border-pink-200 dark:hover:border-pink-800/50 
            hover:bg-pink-50 dark:hover:bg-pink-950/20 
            transition text-left w-full"
            onClick={() => {
                if (onQuestionClick) {
                    onQuestionClick(question);
                }
                openChat(question);
            }}
        >
            <span className={`w-2 h-2 rounded-full ${color} shrink-0`}></span>
            <span className="text-xs text-slate-700 dark:text-slate-300">{question}</span>
        </button>
    )

    return (
        <div className={`card p-4 
                bg-white dark:bg-[#2a2a2e] 
                border border-slate-200/60 dark:border-slate-700/60 
                rounded-xl shadow-sm 
                dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)] 
                ${className}`}>
            <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-slate-900 dark:text-white text-sm">
                    <i className="fas fa-robot text-pink-500 dark:text-pink-400 mr-2"></i>
                    {title}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                    <i className="fas fa-mouse-pointer mr-1"></i> {subtitle}
                </span>
            </div>
            <div className={`grid ${gridCols} gap-2`}>
                {questions.map((q, i) => (
                    <QuestionButton key={i} {...q} />
                ))}
            </div>
        </div>
    )
}

export default AiQuestions