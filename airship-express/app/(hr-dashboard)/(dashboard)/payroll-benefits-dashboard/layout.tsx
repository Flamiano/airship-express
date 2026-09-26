'use client';

import './hrPayroll.css';
import { SidebarProvider } from './components/layout/SidebarContext';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/app/components/ThemeProvider';

export default function PayrollBenefitsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ThemeProvider>
            <SidebarProvider>
                <div className="min-h-screen" style={{
                    backgroundColor: 'var(--background)',
                    color: 'var(--foreground)'
                }}>
                    {children}
                    <Toaster
                        position="top-right"
                        richColors
                        closeButton
                        toastOptions={{
                            duration: 4000,
                            className: '!bg-paper !text-ink border border-line',
                        }}
                    />
                </div>
            </SidebarProvider>
        </ThemeProvider>
    );
}