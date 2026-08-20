interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

export const Pagination = ({
    currentPage,
    totalPages,
    onPageChange,
}: PaginationProps) => {
    return (
        <div className="flex items-center gap-1.5 text-xs">
            <button
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 font-medium rounded-xl 
                        border border-slate-200/80 dark:border-slate-700/60 
                        bg-white dark:bg-[#2a2a2e] 
                        text-slate-600 dark:text-slate-300 
                        hover:bg-slate-50 dark:hover:bg-slate-700/50 
                        disabled:opacity-40 dark:disabled:opacity-30 
                        disabled:cursor-not-allowed 
                        transition-all duration-150 
                        shadow-2xs dark:shadow-[0_1px_2px_rgba(0,0,0,0.3)]
                        hover:shadow-sm dark:hover:shadow-[0_2px_4px_rgba(0,0,0,0.4)]
                        active:scale-[0.97]"
            >
                <i className="fas fa-chevron-left mr-1 text-[10px]"></i> Previous
            </button>

            <div className="px-3 py-1.5 rounded-xl 
                        bg-white dark:bg-[#2a2a2e] 
                        border border-slate-200/80 dark:border-slate-700/60 
                        font-semibold text-slate-700 dark:text-slate-200 
                        shadow-2xs dark:shadow-[0_1px_2px_rgba(0,0,0,0.3)]
                        min-w-[70px] text-center">
                {currentPage} <span className="text-slate-300 dark:text-slate-500 font-normal">/</span> {totalPages}
            </div>

            <button
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 font-medium rounded-xl 
                        border border-slate-200/80 dark:border-slate-700/60 
                        bg-white dark:bg-[#2a2a2e] 
                        text-slate-600 dark:text-slate-300 
                        hover:bg-slate-50 dark:hover:bg-slate-700/50 
                        disabled:opacity-40 dark:disabled:opacity-30 
                        disabled:cursor-not-allowed 
                        transition-all duration-150 
                        shadow-2xs dark:shadow-[0_1px_2px_rgba(0,0,0,0.3)]
                        hover:shadow-sm dark:hover:shadow-[0_2px_4px_rgba(0,0,0,0.4)]
                        active:scale-[0.97]"
            >
                Next <i className="fas fa-chevron-right ml-1 text-[10px]"></i>
            </button>
        </div>
    );
};