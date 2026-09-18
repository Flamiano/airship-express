
'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { ChatbotDashboard } from '../modules/chatbot';
import DashboardLoader from '../components/DashboardLoader';
import { useInactivityTimer } from '../../../hooks/useInactivityTimer';

export default function ChatbotPage() {
    const [isLoading, setIsLoading] = useState(true);
    const { resetTimer } = useInactivityTimer({ enabled: false });

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsLoading(false);
            resetTimer();
        }, 800);

        return () => {
            clearTimeout(timer);
            resetTimer();
        };
    }, [resetTimer]);

    return (
        <DashboardLayout>
            <div className="h-full min-h-0 w-full overflow-hidden">
                {isLoading ? <DashboardLoader /> : <ChatbotDashboard />}
            </div>
        </DashboardLayout>
    );
}