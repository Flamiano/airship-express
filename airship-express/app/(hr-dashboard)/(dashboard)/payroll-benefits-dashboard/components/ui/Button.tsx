import React from 'react';
import { cn } from '../../utils/helpers/classNames';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    loading?: boolean;
    fullWidth?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    className,
    variant = 'primary',
    size = 'md',
    loading = false,
    fullWidth = false,
    leftIcon,
    rightIcon,
    disabled,
    ...props
}) => {
    // Each variant now carries a resting shadow + a stronger hover shadow so the
    // button visibly "lifts". active: classes flatten it back down on press.
    const variantClasses = {
        primary:
            'bg-blue-600 text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700 hover:shadow-md hover:shadow-blue-600/30 active:bg-blue-800 focus-visible:ring-blue-500',
        secondary:
            'bg-gray-600 text-white shadow-sm shadow-gray-600/20 hover:bg-gray-700 hover:shadow-md hover:shadow-gray-600/30 active:bg-gray-800 focus-visible:ring-gray-500',
        success:
            'bg-green-600 text-white shadow-sm shadow-green-600/20 hover:bg-green-700 hover:shadow-md hover:shadow-green-600/30 active:bg-green-800 focus-visible:ring-green-500',
        danger:
            'bg-red-600 text-white shadow-sm shadow-red-600/20 hover:bg-red-700 hover:shadow-md hover:shadow-red-600/30 active:bg-red-800 focus-visible:ring-red-500',
        warning:
            'bg-yellow-600 text-white shadow-sm shadow-yellow-600/20 hover:bg-yellow-700 hover:shadow-md hover:shadow-yellow-600/30 active:bg-yellow-800 focus-visible:ring-yellow-500',
        outline:
            'bg-transparent border-2 border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50 active:bg-gray-100 focus-visible:ring-gray-300',
        ghost:
            'bg-transparent text-gray-700 hover:bg-gray-100 active:bg-gray-200 focus-visible:ring-gray-300',
    };

    const sizeClasses = {
        sm: 'px-3 py-1.5 text-sm gap-1.5',
        md: 'px-4 py-2 text-base gap-2',
        lg: 'px-6 py-3 text-lg gap-2.5',
        icon: 'p-2',
    };

    const isDisabled = disabled || loading;

    return (
        <button
            className={cn(
                // base
                'relative inline-flex select-none items-center justify-center font-medium rounded-lg',
                // motion: lift on hover, press down on click, spring back on release
                'transform-gpu transition-all duration-150 ease-out will-change-transform',
                'hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97]',
                // focus ring only shows for keyboard users, not mouse clicks
                'outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                // disabled state kills all interactivity feedback
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:active:scale-100 disabled:shadow-none',
                variantClasses[variant],
                sizeClasses[size],
                fullWidth && 'w-full',
                className
            )}
            disabled={isDisabled}
            aria-busy={loading || undefined}
            {...props}
        >
            {loading && (
                <svg
                    className="h-4 w-4 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                    />
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                </svg>
            )}
            {!loading && leftIcon && <span className="inline-flex">{leftIcon}</span>}
            <span className={cn(loading && 'opacity-0')}>{children}</span>
            {!loading && rightIcon && <span className="inline-flex">{rightIcon}</span>}
        </button>
    );
};