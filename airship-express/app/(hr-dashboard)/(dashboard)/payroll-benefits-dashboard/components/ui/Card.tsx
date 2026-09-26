import React from 'react';
import { cn } from '../../utils/helpers/classNames';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'outlined' | 'elevated';
    padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
    children,
    className,
    variant = 'default',
    padding = 'md',
    ...props
}) => {
    const variantClasses = {
        default: 'bg-white border border-gray-200',
        outlined: 'bg-transparent border-2 border-gray-300',
        elevated: 'bg-white shadow-lg hover:shadow-xl transition-shadow duration-300',
    };

    const paddingClasses = {
        none: 'p-0',
        sm: 'p-3',
        md: 'p-6',
        lg: 'p-8',
    };

    return (
        <div
            className={cn(
                'rounded-lg',
                variantClasses[variant],
                paddingClasses[padding],
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
};

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
    title?: string;
    subtitle?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
    children,
    className,
    title,
    subtitle,
    ...props
}) => {
    return (
        <div className={cn('mb-4', className)} {...props}>
            {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
            {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
            {children}
        </div>
    );
};

export const CardBody: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
    children,
    className,
    ...props
}) => {
    return (
        <div className={cn('', className)} {...props}>
            {children}
        </div>
    );
};

interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
    align?: 'left' | 'center' | 'right';
}

export const CardFooter: React.FC<CardFooterProps> = ({
    children,
    className,
    align = 'left',
    ...props
}) => {
    const alignClasses = {
        left: 'text-left',
        center: 'text-center',
        right: 'text-right',
    };

    return (
        <div
            className={cn('mt-4 pt-4 border-t border-gray-200', alignClasses[align], className)}
            {...props}
        >
            {children}
        </div>
    );
};