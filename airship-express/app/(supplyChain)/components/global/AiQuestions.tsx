'use client';
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
const AiQuestions = ({ questions = defaultQuestions, title = "AI Suggested Questions", subtitle = "Click to ask", className = "", gridCols = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4", onQuestionClick }: AiQuestionsProps) => {
    const { openChat } = useAI();
    const QuestionButton = ({ question, color = "bg-pink-500" }: Question) => (<button type="button" className="group flex items-center gap-2.5 px-4 py-3 rounded-2xl 
            bg-[#f0f3f8] dark:bg-[#1d1e28]
            border border-white/70 dark:border-[#2a2b38] 
            hover:border-pink-300 dark:hover:border-pink-500/50 
            shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] 
            dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)]
            hover:shadow-[1px_1px_3px_rgba(166,175,195,0.5),-1px_-1px_3px_rgba(255,255,255,0.9)]
            active:scale-95 
            transition-all duration-200 text-left w-full cursor-pointer" onClick={() => {
            if (onQuestionClick) {
                onQuestionClick(question);
            }
            openChat(question);
        }}>
            <span className={`w-2.5 h-2.5 rounded-full ${color} shrink-0 shadow-[0_2px_4px_rgba(236,72,153,0.3)] group-hover:scale-110 transition-transform`}></span>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors line-clamp-2">
                {question}
            </span>
        </button>);
    return (<div className={`p-4 sm:p-5 
                bg-[#f0f3f8] dark:bg-[#191a24]
                border border-white/80 dark:border-[#2c2d3c] 
                rounded-3xl shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] 
                dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] 
                ${className}`}>
            <div className="flex items-center justify-between mb-3.5">
                <span className="font-bold text-slate-900 dark:text-white text-sm flex items-center">
                    <span className="w-7 h-7 rounded-xl bg-gradient-to-tr from-pink-500 to-rose-400 text-white flex items-center justify-center mr-2 shadow-[0_2px_6px_rgba(236,72,153,0.35),inset_0_1px_0_rgba(255,255,255,0.4)]">
                        <i className="fas fa-robot text-xs"></i>
                    </span>
                    {title}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 font-medium">
                    <i className="fas fa-mouse-pointer text-[10px]"></i> {subtitle}
                </span>
            </div>
            <div className={`grid ${gridCols} gap-3`}>
                {questions.map((q, i) => (<QuestionButton key={i} {...q}/>))}
            </div>
        </div>);
};
export default AiQuestions;
