'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { PayrollDashboard } from '../modules/payroll';
import DashboardLoader from '../components/DashboardLoader';
import { useInactivityTimer } from '../../../hooks/useInactivityTimer';

export default function PayrollPage() {
    const [isLoading, setIsLoading] = useState(true);
    const { resetTimer } = useInactivityTimer({ enabled: false });

    useEffect(() => {
        resetTimer();

        const timer = setTimeout(() => {
            setIsLoading(false);
            resetTimer();
        }, 800);

        return () => {
            clearTimeout(timer);
            resetTimer();
        };
    }, [resetTimer]);

    useEffect(() => {
        resetTimer();
    }, [isLoading, resetTimer]);

    return (
        <DashboardLayout>
            {isLoading ? <DashboardLoader /> : <PayrollDashboard />}
        </DashboardLayout>
    );
}