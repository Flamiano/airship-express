'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from './components/layout/DashboardLayout';
import { PayrollDashboard } from './modules/dashboard/PayrollDashboard';
import DashboardLoader from './components/DashboardLoader';

export default function PayrollBenefitsDashboardPage() {
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 1500);
        return () => clearTimeout(timer);
    }, []);

    return (
        <DashboardLayout>
            {isLoading ? <DashboardLoader /> : <PayrollDashboard />}
        </DashboardLayout>
    );
}