"use client";

import { useEffect, useState, useCallback, ReactNode, Children, cloneElement, isValidElement } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { NavBtn } from '@/app/(supplyChain)/components/global/Buttons';
import ManualEntryModal from '@/app/(supplyChain)/(pages)/warehousing/components/client/incoming/ManualEntryModal';

interface TabsWrapperProps {
    children: ReactNode;
}

interface PanelProps {
    'data-panel'?: string;
    className?: string;
    children?: ReactNode;
}

declare global {
    interface Window {
        openManualEntryModal?: () => void;
        closeManualEntryModal?: () => void;
        handleManualEntry?: () => void;
    }
}

export default function TabsWrapper({ children }: TabsWrapperProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState<string>('dashboard');

    const getTabFromUrl = useCallback(() => {
        const tab = searchParams.get('tab');
        return tab || 'dashboard';
    }, [searchParams]);

    const handleTabChange = useCallback((tabId: string) => {
        if (tabId === activeTab) return;
        setActiveTab(tabId);
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', tabId);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, [activeTab, searchParams, pathname, router]);

    useEffect(() => {
        const tabFromUrl = getTabFromUrl();
        if (tabFromUrl !== activeTab) {
            setActiveTab(tabFromUrl);
        }
    }, [searchParams, getTabFromUrl]);

    useEffect(() => {
        if (typeof window === "undefined") return;

        window.openManualEntryModal = () => {
            const modal = document.querySelector('[data-manual-modal]') as HTMLElement;
            if (modal) modal.style.display = 'flex';
        };

        window.closeManualEntryModal = () => {
            const modal = document.querySelector('[data-manual-modal]') as HTMLElement;
            if (modal) modal.style.display = 'none';
        };

        return () => {
            delete window.openManualEntryModal;
            delete window.closeManualEntryModal;
        };
    }, []);

    //  render yung children with hidden class based on data-panel
    const renderChildren = () => {
        return Children.map(children, (child) => {
            if (isValidElement<PanelProps>(child)) {
                const panelName = child.props['data-panel'] || 'dashboard';
                const isActive = panelName === activeTab;
                const existingClassName = child.props.className || '';
                const newClassName = `${existingClassName} ${!isActive ? 'hidden' : ''}`.trim();

                return cloneElement(child, {
                    ...child.props,
                    className: newClassName,
                });
            }
            return child;
        });
    };

    useEffect(() => {
        const initialTab = getTabFromUrl();
        setActiveTab(initialTab);
    }, [getTabFromUrl]);

    useEffect(() => {
        document.querySelectorAll(".tab-btn").forEach((btn) => {
            const tabId = btn.getAttribute("data-tab");
            if (tabId === activeTab) {
                btn.classList.add("border-pink-500", "text-pink-600");
                btn.classList.remove("border-transparent", "text-slate-500");
            } else {
                btn.classList.remove("border-pink-500", "text-pink-600");
                btn.classList.add("border-transparent", "text-slate-500");
            }
        });
    }, [activeTab]);

    return (
        <>
            <div
                id="tabs"
                className="sticky top-0 z-20 flex gap-1 px-2 overflow-x-auto no-scrollbar scroll-smooth bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-100 dark:border-white/10 transition-colors"
            >
                <NavBtn
                    link="dashboard"
                    data-tab="dashboard"
                    color={
                        activeTab === "dashboard"
                            ? "border-pink-500 text-pink-600 dark:text-pink-400 dark:border-pink-500 bg-pink-50/50 dark:bg-pink-950/30"
                            : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/40"
                    }
                    icon="fas fa-chart-pie mr-2 text-xs opacity-90"
                    label="Dashboard"
                    onClick={() => handleTabChange("dashboard")}
                />

                <NavBtn
                    link="incoming"
                    data-tab="incoming"
                    color={
                        activeTab === "incoming"
                            ? "border-pink-500 text-pink-600 dark:text-pink-400 dark:border-pink-500 bg-pink-50/50 dark:bg-pink-950/30"
                            : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/40"
                    }
                    icon="fas fa-arrow-down mr-2 text-xs opacity-90"
                    label="Inbound Receiving"
                    onClick={() => handleTabChange("incoming")}
                />

                <NavBtn
                    link="sorting"
                    data-tab="sorting"
                    color={
                        activeTab === "sorting"
                            ? "border-pink-500 text-pink-600 dark:text-pink-400 dark:border-pink-500 bg-pink-50/50 dark:bg-pink-950/30"
                            : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/40"
                    }
                    icon="fas fa-sort mr-2 text-xs opacity-90"
                    label="Courier Sorting"
                    onClick={() => handleTabChange("sorting")}
                />

                <NavBtn
                    link="outgoing"
                    data-tab="outgoing"
                    color={
                        activeTab === "outgoing"
                            ? "border-pink-500 text-pink-600 dark:text-pink-400 dark:border-pink-500 bg-pink-50/50 dark:bg-pink-950/30"
                            : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/40"
                    }
                    icon="fas fa-arrow-up mr-2 text-xs opacity-90"
                    label="Outgoing Pickup"
                    onClick={() => handleTabChange("outgoing")}
                />
            </div>

            <div className="relative">
                {renderChildren()}
            </div>

        </>
    );
}