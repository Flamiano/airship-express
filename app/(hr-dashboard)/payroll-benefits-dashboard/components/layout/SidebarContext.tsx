'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

type SidebarContextType = {
    isOpen: boolean;
    toggle: () => void;
    close: () => void;
    isCollapsed: boolean;
    toggleCollapsed: () => void;
};

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <SidebarContext.Provider
            value={{
                isOpen,
                toggle: () => setIsOpen((v) => !v),
                close: () => setIsOpen(false),
                isCollapsed,
                toggleCollapsed: () => setIsCollapsed((v) => !v),
            }}
        >
            {children}
        </SidebarContext.Provider>
    );
}

export function useSidebar() {
    const ctx = useContext(SidebarContext);
    if (!ctx) throw new Error('useSidebar must be used within a SidebarProvider');
    return ctx;
}