import React, { useState, useRef, useEffect } from 'react';
import { Search as SearchIcon, X } from 'lucide-react';
import { cn } from '../../utils/helpers/classNames';

interface SearchProps {
    placeholder?: string;
    onSearch: (query: string) => void;
    className?: string;
    debounceDelay?: number;
    initialValue?: string;
}

export const Search: React.FC<SearchProps> = ({
    placeholder = 'Search...',
    onSearch,
    className = '',
    debounceDelay = 300,
    initialValue = '',
}) => {
    const [query, setQuery] = useState(initialValue);
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout>();

    useEffect(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            onSearch(query);
        }, debounceDelay);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [query, debounceDelay, onSearch]);

    const handleClear = () => {
        setQuery('');
        onSearch('');
        inputRef.current?.focus();
    };

    return (
        <div
            className={`relative flex items-center ${className}`}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
        >
            <SearchIcon
                className={`absolute left-3 h-4 w-4 transition-colors ${isFocused ? 'text-blue-500' : 'text-gray-400'
                    }`}
            />
            <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="w-full pl-10 pr-10 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
            />
            {query && (
                <button
                    onClick={handleClear}
                    className="absolute right-3 p-1 hover:bg-gray-100 rounded-full transition-colors"
                    aria-label="Clear search"
                >
                    <X className="h-4 w-4 text-gray-400" />
                </button>
            )}
        </div>
    );
};