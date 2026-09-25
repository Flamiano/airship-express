"use client";
import { useEffect, useState, useCallback, ReactNode, Children, cloneElement, isValidElement } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { NavBtn } from '../../../components/global/Buttons';
import { useUserRole } from "../../../components/global/UnauthorizedEmptyState";

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
    const { isPrivileged, isLoaded } = useUserRole();
    const [activeTab, setActiveTab] = useState<string>('dashboard');

    const getTabFromUrl = useCallback(() => {
        const tab = searchParams.get('tab');
        if (tab) return tab;
        return isPrivileged ? 'dashboard' : 'incoming';
    }, [searchParams, isPrivileged]);
    const handleTabChange = useCallback((tabId: string) => {
        if (tabId === activeTab)
            return;
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
        if (typeof window === "undefined")
            return;
        window.openManualEntryModal = () => {
            const modal = document.querySelector('[data-manual-modal]') as HTMLElement;
            if (modal)
                modal.style.display = 'flex';
        };
        window.closeManualEntryModal = () => {
            const modal = document.querySelector('[data-manual-modal]') as HTMLElement;
            if (modal)
                modal.style.display = 'none';
        };
        return () => {
            delete window.openManualEntryModal;
            delete window.closeManualEntryModal;
        };
    }, []);
    // render children
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
    return (<>
            <div id="tabs" className="sticky top-0 z-20 flex gap-2 p-2 overflow-x-auto no-scrollbar scroll-smooth bg-[#ebf0f7]/95 dark:bg-[#14151c]/95 backdrop-blur-md shadow-[inset_2px_2px_5px_rgba(166,175,195,0.4),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)] border-b border-slate-200/60 dark:border-slate-800/80 transition-colors">
                <NavBtn
                    link="dashboard"
                    data-tab="dashboard"
                    isActive={activeTab === "dashboard"}
                    icon={isLoaded && !isPrivileged ? "fas fa-lock" : "fas fa-chart-pie"}
                    label={isLoaded && !isPrivileged ? "Dashboard (Restricted)" : "Dashboard"}
                    onClick={() => handleTabChange("dashboard")}
                />
                <NavBtn link="incoming" data-tab="incoming" isActive={activeTab === "incoming"} icon="fas fa-arrow-down" label="Inbound Receiving" onClick={() => handleTabChange("incoming")}/>
                <NavBtn link="sorting" data-tab="sorting" isActive={activeTab === "sorting"} icon="fas fa-sort" label="Courier Sorting" onClick={() => handleTabChange("sorting")}/>
                <NavBtn link="outgoing" data-tab="outgoing" isActive={activeTab === "outgoing"} icon="fas fa-arrow-up" label="Outgoing Pickup" onClick={() => handleTabChange("outgoing")}/>
            </div>

            <div className="relative">
                {renderChildren()}
            </div>

        </>);
}
