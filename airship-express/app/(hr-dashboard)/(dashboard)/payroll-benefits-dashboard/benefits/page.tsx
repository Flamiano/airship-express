'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { BenefitsDashboard } from '../modules/benefits';
import DashboardLoader from '../components/DashboardLoader';
import { useInactivityTimer } from '../../../hooks/useInactivityTimer';

export default function BenefitsPage() {
    const [isLoading, setIsLoading] = useState(true);
    const { resetTimer } = useInactivityTimer({ enabled: false });

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsLoading(false);
            resetTimer();
        }, 1500);
        return () => clearTimeout(timer);
    }, [resetTimer]);

    return (
        <DashboardLayout>
            {isLoading ? <DashboardLoader /> : <BenefitsDashboard />}
        </DashboardLayout>
    );
}