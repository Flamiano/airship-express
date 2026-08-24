'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { PayrollDashboard } from '../modules/payroll';
import DashboardLoader from '../components/DashboardLoader';

export default function PayrollPage() {
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 800);
        return () => clearTimeout(timer);
    }, []);

    return (
        <DashboardLayout>
            {isLoading ? <DashboardLoader /> : <PayrollDashboard />}
        </DashboardLayout>
    );
}