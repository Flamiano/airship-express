import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, Shield, Building2, CreditCard } from 'lucide-react';
import { cn } from '../../utils/helpers/classNames';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'sss' | 'philhealth' | 'pagibig';

export interface ToastItem {
    id: string;
    title?: string;
    message: string;
    variant?: ToastVariant;
    duration?: number;
    icon?: React.ReactNode;
    action?: {
        label: string;
        onClick: () => void;
    };
}

interface ToastContextType {
    showToast: (message: string, variant?: ToastVariant, title?: string, duration?: number, options?: any) => void;
    showSuccess: (message: string, title?: string) => void;
    showError: (message: string, title?: string) => void;
    showWarning: (message: string, title?: string) => void;
    showInfo: (message: string, title?: string) => void;
    showSSS: (message: string, title?: string) => void;
    showPhilHealth: (message: string, title?: string) => void;
    showPagIBIG: (message: string, title?: string) => void;
    hideToast: (id: string) => void;
    dismissAll: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

interface ToastProviderProps {
    children: React.ReactNode;
    position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
    maxToasts?: number;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({
    children,
    position = 'top-right',
    maxToasts = 5
}) => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const hideToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    const dismissAll = useCallback(() => {
        setToasts([]);
    }, []);

    const showToast = useCallback((
        message: string,
        variant: ToastVariant = 'info',
        title?: string,
        duration: number = 5000,
        options?: any
    ) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setToasts(prev => {
            const newToasts = [{ id, message, variant, title, duration, ...options }, ...prev];
            return newToasts.slice(0, maxToasts);
        });
        if (duration > 0) {
            setTimeout(() => {
                hideToast(id);
            }, duration + 300);
        }
    }, [hideToast, maxToasts]);

    const showSuccess = useCallback((message: string, title?: string) => {
        showToast(message, 'success', title || 'Success');
    }, [showToast]);

    const showError = useCallback((message: string, title?: string) => {
        showToast(message, 'error', title || 'Error');
    }, [showToast]);

    const showWarning = useCallback((message: string, title?: string) => {
        showToast(message, 'warning', title || 'Warning');
    }, [showToast]);

    const showInfo = useCallback((message: string, title?: string) => {
        showToast(message, 'info', title || 'Info');
    }, [showToast]);

    const showSSS = useCallback((message: string, title?: string) => {
        showToast(message, 'sss', title || 'SSS Contribution');
    }, [showToast]);

    const showPhilHealth = useCallback((message: string, title?: string) => {
        showToast(message, 'philhealth', title || 'PhilHealth');
    }, [showToast]);

    const showPagIBIG = useCallback((message: string, title?: string) => {
        showToast(message, 'pagibig', title || 'Pag-IBIG');
    }, [showToast]);

    const value = {
        showToast,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        showSSS,
        showPhilHealth,
        showPagIBIG,
        hideToast,
        dismissAll
    };

    return (
        <ToastContext.Provider value={value}>
            {children}
            <ToasterContainer toasts={toasts} position={position} />
        </ToastContext.Provider>
    );
};

interface ToastComponentProps extends ToastItem {
    onClose: (id: string) => void;
    index: number;
}

const ToastComponent: React.FC<ToastComponentProps> = ({
    id,
    title,
    message,
    variant = 'info',
    duration = 5000,
    onClose,
    icon,
    action,
    index
}) => {
    const [isVisible, setIsVisible] = useState(true);
    const [isLeaving, setIsLeaving] = useState(false);
    const [progress, setProgress] = useState(100);

    const variantConfig = {
        success: {
            bg: 'bg-green-50 dark:bg-green-950/30',
            border: 'border-green-500 dark:border-green-400',
            text: 'text-green-800 dark:text-green-200',
            titleColor: 'text-green-900 dark:text-green-100',
            icon: CheckCircle,
            iconColor: 'text-green-500 dark:text-green-400',
            progress: 'bg-green-500 dark:bg-green-400',
            shadow: 'shadow-green-100/20 dark:shadow-green-900/30'
        },
        error: {
            bg: 'bg-red-50 dark:bg-red-950/30',
            border: 'border-red-500 dark:border-red-400',
            text: 'text-red-800 dark:text-red-200',
            titleColor: 'text-red-900 dark:text-red-100',
            icon: AlertCircle,
            iconColor: 'text-red-500 dark:text-red-400',
            progress: 'bg-red-500 dark:bg-red-400',
            shadow: 'shadow-red-100/20 dark:shadow-red-900/30'
        },
        warning: {
            bg: 'bg-amber-50 dark:bg-amber-950/30',
            border: 'border-amber-500 dark:border-amber-400',
            text: 'text-amber-800 dark:text-amber-200',
            titleColor: 'text-amber-900 dark:text-amber-100',
            icon: AlertTriangle,
            iconColor: 'text-amber-500 dark:text-amber-400',
            progress: 'bg-amber-500 dark:bg-amber-400',
            shadow: 'shadow-amber-100/20 dark:shadow-amber-900/30'
        },
        info: {
            bg: 'bg-blue-50 dark:bg-blue-950/30',
            border: 'border-blue-500 dark:border-blue-400',
            text: 'text-blue-800 dark:text-blue-200',
            titleColor: 'text-blue-900 dark:text-blue-100',
            icon: Info,
            iconColor: 'text-blue-500 dark:text-blue-400',
            progress: 'bg-blue-500 dark:bg-blue-400',
            shadow: 'shadow-blue-100/20 dark:shadow-blue-900/30'
        },
        sss: {
            bg: 'bg-[#eef3fe] dark:bg-[#182241]/50',
            border: 'border-[#2455c7] dark:border-[#6f97ff]',
            text: 'text-[#2455c7] dark:text-[#6f97ff]',
            titleColor: 'text-[#2455c7] dark:text-[#6f97ff]',
            icon: Shield,
            iconColor: 'text-[#2455c7] dark:text-[#6f97ff]',
            progress: 'bg-[#2455c7] dark:bg-[#6f97ff]',
            shadow: 'shadow-[#2455c7]/10 dark:shadow-[#6f97ff]/10'
        },
        philhealth: {
            bg: 'bg-[#e9f8f2] dark:bg-[#0e2b23]/50',
            border: 'border-[#0b8f6b] dark:border-[#2fd6a4]',
            text: 'text-[#0b8f6b] dark:text-[#2fd6a4]',
            titleColor: 'text-[#0b8f6b] dark:text-[#2fd6a4]',
            icon: Building2,
            iconColor: 'text-[#0b8f6b] dark:text-[#2fd6a4]',
            progress: 'bg-[#0b8f6b] dark:bg-[#2fd6a4]',
            shadow: 'shadow-[#0b8f6b]/10 dark:shadow-[#2fd6a4]/10'
        },
        pagibig: {
            bg: 'bg-[#fbf1de] dark:bg-[#35260f]/50',
            border: 'border-[#b8720e] dark:border-[#f0a53d]',
            text: 'text-[#b8720e] dark:text-[#f0a53d]',
            titleColor: 'text-[#b8720e] dark:text-[#f0a53d]',
            icon: CreditCard,
            iconColor: 'text-[#b8720e] dark:text-[#f0a53d]',
            progress: 'bg-[#b8720e] dark:bg-[#f0a53d]',
            shadow: 'shadow-[#b8720e]/10 dark:shadow-[#f0a53d]/10'
        }
    };

    const config = variantConfig[variant];
    const IconComponent = icon ? () => <>{icon}</> : config.icon;

    useEffect(() => {
        if (duration > 0) {
            const interval = setInterval(() => {
                setProgress(prev => {
                    const newProgress = prev - (100 / (duration / 16));
                    return newProgress <= 0 ? 0 : newProgress;
                });
            }, 16);
            return () => clearInterval(interval);
        }
    }, [duration]);

    const handleClose = () => {
        setIsLeaving(true);
        setTimeout(() => {
            setIsVisible(false);
            onClose(id);
        }, 300);
    };

    if (!isVisible) return null;

    return (
        <div
            className={cn(
                'w-full max-w-sm pointer-events-auto rounded-xl border-l-4 shadow-lg overflow-hidden transform transition-all duration-300',
                config.bg,
                config.border,
                config.shadow,
                !isLeaving ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0',
                index > 0 && 'mt-3'
            )}
            style={{
                animation: !isLeaving ? 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)' : undefined,
                boxShadow: `0 10px 40px -10px rgba(0,0,0,0.05), 0 4px 12px -2px rgba(0,0,0,0.03)`
            }}
        >
            {duration > 0 && (
                <div className="relative h-1 overflow-hidden bg-black/5 dark:bg-white/5">
                    <div
                        className={cn(
                            'absolute inset-0 transition-all duration-100 ease-linear',
                            config.progress
                        )}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}
            <div className="p-4">
                <div className="flex items-start gap-3">
                    <div className={cn(
                        'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
                        config.bg,
                        'border border-current/10'
                    )}>
                        <IconComponent className={cn('h-5 w-5', config.iconColor)} />
                    </div>
                    <div className="flex-1 min-w-0">
                        {title && (
                            <p className={cn('text-sm font-semibold tracking-tight', config.titleColor)}>
                                {title}
                            </p>
                        )}
                        <p className={cn('text-sm mt-0.5 leading-relaxed', config.text)}>
                            {message}
                        </p>
                        {action && (
                            <button
                                onClick={action.onClick}
                                className={cn(
                                    'mt-2 text-xs font-medium px-3 py-1 rounded-lg transition-colors',
                                    config.bg,
                                    config.text,
                                    'hover:bg-black/5 dark:hover:bg-white/5'
                                )}
                            >
                                {action.label}
                            </button>
                        )}
                    </div>
                    <button
                        onClick={handleClose}
                        className={cn(
                            'flex-shrink-0 p-1 rounded-lg transition-colors',
                            config.text,
                            'hover:bg-black/5 dark:hover:bg-white/5'
                        )}
                        aria-label="Dismiss toast"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

interface ToasterContainerProps {
    toasts: ToastItem[];
    position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

const ToasterContainer: React.FC<ToasterContainerProps> = ({
    toasts,
    position = 'top-right'
}) => {
    const positionClasses = {
        'top-right': 'top-0 right-0',
        'top-left': 'top-0 left-0',
        'bottom-right': 'bottom-0 right-0',
        'bottom-left': 'bottom-0 left-0',
        'top-center': 'top-0 left-1/2 -translate-x-1/2',
        'bottom-center': 'bottom-0 left-1/2 -translate-x-1/2'
    };

    if (toasts.length === 0) return null;

    return (
        <div
            className={cn(
                'fixed z-[9999] p-4 w-full max-w-sm pointer-events-none',
                positionClasses[position]
            )}
            role="region"
            aria-label="Notifications"
        >
            {toasts.map((toast, index) => (
                <ToastComponent
                    key={toast.id}
                    {...toast}
                    index={index}
                    onClose={(id) => { }}
                />
            ))}
        </div>
    );
};

const styles = `
@keyframes slideInRight {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
@keyframes slideOutRight {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
}
`;

if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
}

export default ToastProvider;