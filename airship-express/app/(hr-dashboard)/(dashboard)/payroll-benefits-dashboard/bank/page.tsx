'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { BankDashboard } from '../modules/bank';
import DashboardLoader from '../components/DashboardLoader';
import { useInactivityTimer } from '../../../hooks/useInactivityTimer';

export default function BankPage() {
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
            {isLoading ? <DashboardLoader /> : <BankDashboard />}
        </DashboardLayout>
    );
}