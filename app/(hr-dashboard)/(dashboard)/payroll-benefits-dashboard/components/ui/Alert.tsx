import React, { useState } from 'react';
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '../../utils/helpers/classNames';

interface AlertProps {
    variant?: 'info' | 'success' | 'warning' | 'error';
    title?: string;
    message: string;
    className?: string;
    dismissible?: boolean;
    onDismiss?: () => void;
    icon?: React.ReactNode;
}

export const Alert: React.FC<AlertProps> = ({
    variant = 'info',
    title,
    message,
    className,
    dismissible = false,
    onDismiss,
    icon,
}) => {
    const [isVisible, setIsVisible] = useState(true);

    const variantClasses = {
        info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-500 text-blue-800 dark:text-blue-300',
        success: 'bg-green-50 dark:bg-green-900/20 border-green-400 dark:border-green-500 text-green-800 dark:text-green-300',
        warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-400 dark:border-yellow-500 text-yellow-800 dark:text-yellow-300',
        error: 'bg-red-50 dark:bg-red-900/20 border-red-400 dark:border-red-500 text-red-800 dark:text-red-300',
    };

    const iconMap = {
        info: Info,
        success: CheckCircle,
        warning: AlertTriangle,
        error: AlertCircle,
    };

    const IconComponent = iconMap[variant];

    const handleDismiss = () => {
        setIsVisible(false);
        onDismiss?.();
    };

    if (!isVisible) return null;

    return (
        <div
            className={cn(
                'flex items-start gap-3 p-4 border-l-4 rounded-r-lg',
                variantClasses[variant],
                className
            )}
            role="alert"
        >
            {icon || <IconComponent className="h-5 w-5 flex-shrink-0 mt-0.5" />}
            <div className="flex-1 min-w-0">
                {title && <h4 className="text-sm font-semibold">{title}</h4>}
                <p className="text-sm">{message}</p>
            </div>
            {dismissible && (
                <button
                    onClick={handleDismiss}
                    className="flex-shrink-0 p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"
                    aria-label="Dismiss alert"
                >
                    <X className="h-4 w-4" />
                </button>
            )}
        </div>
    );
};