'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import DashboardLoader from '../components/DashboardLoader';
import { useInactivityTimer } from '../../../hooks/useInactivityTimer';
import JobPositionSettingsManager from '../modules/payroll/JobPositionSettingsManager/page';

export default function JobSettingsPage() {
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
            <div className="p-4 sm:p-6">
                {isLoading ? <DashboardLoader /> : <JobPositionSettingsManager />}
            </div>
        </DashboardLayout>
    );
}