'use client';

import './hrPayroll.css';
import { SidebarProvider } from './components/layout/SidebarContext';
import { Toaster } from 'sonner';


export default function PayrollBenefitsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <SidebarProvider>
            {children}
            <Toaster position="top-right" />
        </SidebarProvider>
    );
}