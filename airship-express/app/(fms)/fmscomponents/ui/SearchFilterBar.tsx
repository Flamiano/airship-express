import React from "react";
import { Search, X } from "lucide-react";

interface SearchFilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  children?: React.ReactNode;
  className?: string;
}

export function SearchFilterBar({
  searchTerm,
  onSearchChange,
  placeholder = "Search...",
  children,
  className = "",
}: SearchFilterBarProps) {
  return (
    <div className={`flex flex-col sm:flex-row gap-3 items-center justify-between w-full ${className}`}>
      <div className="relative w-full sm:max-w-md flex-1 group">
        <Search 
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-[#e5167e] transition-colors" 
          aria-hidden="true" 
        />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-9 pr-9 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#e5167e]/20 focus:border-[#e5167e] transition-all shadow-sm"
          aria-label="Search input"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-[#e5167e]/50 rounded-sm"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      
      {children && (
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {children}
        </div>
      )}
    </div>
  );
}