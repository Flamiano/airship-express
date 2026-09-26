'use client';

import './hrPayroll.css';
import { Toaster } from 'sonner';
import * as SidebarContextModule from './components/layout/SidebarContext';
import * as ThemeProviderModule from '@/app/components/ThemeProvider';
import ProtectedPage from './ProtectedPage';

const SidebarProvider =
    (SidebarContextModule as any).SidebarProvider ||
    (SidebarContextModule as any).default;

const ThemeProvider =
    (ThemeProviderModule as any).ThemeProvider ||
    (ThemeProviderModule as any).default;

export default function PayrollBenefitsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const inner = (
        <ProtectedPage>
            <div
                className="min-h-screen"
                style={{
                    backgroundColor: 'var(--background)',
                    color: 'var(--foreground)',
                }}
            >
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
        </ProtectedPage>
    );

    const hasSidebar = typeof SidebarProvider === 'function';
    const hasTheme = typeof ThemeProvider === 'function';

    if (hasTheme && hasSidebar) {
        return (
            <ThemeProvider>
                <SidebarProvider>{inner}</SidebarProvider>
            </ThemeProvider>
        );
    }
    if (hasTheme) {
        return <ThemeProvider>{inner}</ThemeProvider>;
    }
    if (hasSidebar) {
        return <SidebarProvider>{inner}</SidebarProvider>;
    }
    return inner;
}