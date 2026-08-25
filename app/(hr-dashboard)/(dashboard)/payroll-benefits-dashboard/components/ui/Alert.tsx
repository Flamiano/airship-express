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
        info: 'bg-blue-50 border-blue-400 text-blue-800',
        success: 'bg-green-50 border-green-400 text-green-800',
        warning: 'bg-yellow-50 border-yellow-400 text-yellow-800',
        error: 'bg-red-50 border-red-400 text-red-800',
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
                    className="flex-shrink-0 p-1 hover:bg-white/20 rounded-full transition-colors"
                    aria-label="Dismiss alert"
                >
                    <X className="h-4 w-4" />
                </button>
            )}
        </div>
    );
};