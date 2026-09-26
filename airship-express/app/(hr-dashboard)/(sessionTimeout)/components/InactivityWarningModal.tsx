'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface InactivityWarningModalProps {
    isOpen: boolean;
    onStayActive: () => void;
    onLogout: () => void;
    timeRemaining?: number;
}

export default function InactivityWarningModal({
    isOpen,
    onStayActive,
    onLogout,
    timeRemaining = 30,
}: InactivityWarningModalProps) {
    const [countdown, setCountdown] = useState(Math.floor(timeRemaining));

    useEffect(() => {
        if (!isOpen) return;

        setCountdown(Math.floor(timeRemaining));

        const interval = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [isOpen, timeRemaining]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
                onClick={(e) => {
                    if (e.target === e.currentTarget) {
                        onStayActive();
                    }
                }}
            >
                <motion.div
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 20 }}
                    className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6"
                >
                    <div className="text-center">
                        <div className="mx-auto w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mb-4">
                            <svg
                                className="w-8 h-8 text-yellow-600 dark:text-yellow-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                            </svg>
                        </div>

                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                            Session Expiring Soon
                        </h3>

                        <p className="text-gray-600 dark:text-gray-300 mb-4">
                            You will be automatically logged out in{' '}
                            <span className="font-bold text-yellow-600 dark:text-yellow-400">
                                {countdown}s
                            </span>{' '}
                            due to inactivity.
                        </p>

                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-6">
                            <div
                                className="bg-yellow-500 h-2 rounded-full transition-all duration-1000"
                                style={{
                                    width: `${(countdown / timeRemaining) * 100}%`,
                                }}
                            />
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={onStayActive}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
                            >
                                Stay Active
                            </button>
                            <button
                                onClick={onLogout}
                                className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
                            >
                                Logout Now
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}