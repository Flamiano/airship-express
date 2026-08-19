import React from 'react';
import { cn } from '../../utils/helpers/classNames';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'secondary';
    size?: 'sm' | 'md' | 'lg';
    rounded?: boolean;
    dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
    children,
    className,
    variant = 'default',
    size = 'md',
    rounded = false,
    dot = false,
    ...props
}) => {
    const variantClasses = {
        default: 'bg-gray-100 text-gray-800',
        success: 'bg-green-100 text-green-800',
        warning: 'bg-yellow-100 text-yellow-800',
        danger: 'bg-red-100 text-red-800',
        info: 'bg-blue-100 text-blue-800',
        secondary: 'bg-purple-100 text-purple-800',
    };

    const sizeClasses = {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-3 py-1 text-sm',
        lg: 'px-4 py-1.5 text-base',
    };

    const dotColors = {
        default: 'bg-gray-500',
        success: 'bg-green-500',
        warning: 'bg-yellow-500',
        danger: 'bg-red-500',
        info: 'bg-blue-500',
        secondary: 'bg-purple-500',
    };

    return (
        <span
            className={cn(
                'inline-flex items-center font-medium',
                variantClasses[variant],
                sizeClasses[size],
                rounded ? 'rounded-full' : 'rounded',
                className
            )}
            {...props}
        >
            {dot && (
                <span
                    className={cn(
                        'w-2 h-2 rounded-full mr-1.5',
                        dotColors[variant]
                    )}
                />
            )}
            {children}
        </span>
    );
};