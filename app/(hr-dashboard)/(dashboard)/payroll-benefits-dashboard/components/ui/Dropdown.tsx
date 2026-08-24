import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../utils/helpers/classNames';

interface DropdownItem {
    label: string;
    value: any;
    icon?: React.ReactNode;
    disabled?: boolean;
}

interface DropdownProps {
    items: DropdownItem[];
    value?: any;
    onChange?: (value: any) => void;
    placeholder?: string;
    className?: string;
    buttonClassName?: string;
    menuClassName?: string;
    disabled?: boolean;
}

export const Dropdown: React.FC<DropdownProps> = ({
    items,
    value,
    onChange,
    placeholder = 'Select...',
    className,
    buttonClassName,
    menuClassName,
    disabled = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedItem = items.find(item => item.value === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div ref={dropdownRef} className={cn('relative', className)}>
            <button
                type="button"
                className={cn(
                    'w-full flex items-center justify-between px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all',
                    disabled && 'opacity-50 cursor-not-allowed',
                    buttonClassName
                )}
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
            >
                <span className={cn('text-sm', !selectedItem && 'text-gray-400')}>
                    {selectedItem ? selectedItem.label : placeholder}
                </span>
                <ChevronDown
                    className={cn(
                        'h-4 w-4 text-gray-400 transition-transform duration-200',
                        isOpen && 'transform rotate-180'
                    )}
                />
            </button>

            {isOpen && (
                <div
                    className={cn(
                        'absolute z-50 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-auto',
                        menuClassName
                    )}
                >
                    {items.map((item) => (
                        <button
                            key={String(item.value)}
                            className={cn(
                                'w-full flex items-center px-4 py-2 text-sm text-left hover:bg-gray-50 transition-colors',
                                item.value === value && 'bg-blue-50 text-blue-700',
                                item.disabled && 'opacity-50 cursor-not-allowed hover:bg-transparent'
                            )}
                            onClick={() => {
                                if (!item.disabled) {
                                    onChange?.(item.value);
                                    setIsOpen(false);
                                }
                            }}
                            disabled={item.disabled}
                        >
                            {item.icon && <span className="mr-2">{item.icon}</span>}
                            {item.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};