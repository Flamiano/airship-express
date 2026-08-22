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

    const QuestionButton = ({ question, color = "bg-pink-500" }: Question) => (
        <button
            type="button"
            className="group flex items-center gap-2.5 px-3.5 py-3 rounded-2xl 
            bg-slate-50/90 hover:bg-pink-50/60 dark:bg-slate-900/80 dark:hover:bg-pink-950/30
            border border-slate-200/80 dark:border-slate-800 
            hover:border-pink-300 dark:hover:border-pink-500/40 
            shadow-[inset_0_1px_0_#ffffff,0_1px_3px_rgba(0,0,0,0.04)] 
            dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_3px_rgba(0,0,0,0.3)]
            hover:shadow-xs active:scale-[0.98] 
            transition-all duration-200 text-left w-full cursor-pointer"
            onClick={() => {
                if (onQuestionClick) {
                    onQuestionClick(question);
                }
                openChat(question);
            }}
        >
            <span className={`w-2 h-2 rounded-full ${color} shrink-0 shadow-xs group-hover:scale-110 transition-transform`}></span>
            <span className="text-xs font-medium text-slate-700 dark:text-slate-200 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors line-clamp-2">
                {question}
            </span>
        </button>
    )

    return (
        <div className={`p-4 sm:p-5 
                bg-white dark:bg-slate-900/90 
                border border-slate-200/80 dark:border-slate-800 
                rounded-3xl shadow-xs 
                ${className}`}>
            <div className="flex items-center justify-between mb-3.5">
                <span className="font-bold text-slate-900 dark:text-white text-sm flex items-center">
                    <span className="w-6 h-6 rounded-lg bg-pink-50 dark:bg-pink-950/50 text-pink-600 dark:text-pink-400 flex items-center justify-center mr-2 border border-pink-100 dark:border-pink-900/40 shadow-2xs">
                        <i className="fas fa-robot text-xs"></i>
                    </span>
                    {title}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <i className="fas fa-mouse-pointer text-[10px]"></i> {subtitle}
                </span>
            </div>
            <div className={`grid ${gridCols} gap-2.5`}>
                {questions.map((q, i) => (
                    <QuestionButton key={i} {...q} />
                ))}
            </div>
        </div>
    )
}

export default AiQuestions