import React, { useState } from 'react';
import { cn } from '../../utils/helpers/classNames';

interface TabItem {
    label: string;
    value: string;
    icon?: React.ReactNode;
}

interface TabsProps {
    tabs: TabItem[];
    defaultTab?: string;
    onChange?: (value: string) => void;
    className?: string;
    tabClassName?: string;
    activeTabClassName?: string;
    children?: React.ReactNode;
}

export const Tabs: React.FC<TabsProps> = ({
    tabs,
    defaultTab,
    onChange,
    className,
    tabClassName,
    activeTabClassName,
    children,
}) => {
    const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.value);

    const handleTabClick = (value: string) => {
        setActiveTab(value);
        onChange?.(value);
    };

    return (
        <div className={className}>
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    {tabs.map((tab) => (
                        <button
                            key={tab.value}
                            onClick={() => handleTabClick(tab.value)}
                            className={cn(
                                'py-2 px-1 border-b-2 text-sm font-medium transition-all duration-200',
                                activeTab === tab.value
                                    ? cn('border-blue-500 text-blue-600', activeTabClassName)
                                    : cn('border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300', tabClassName)
                            )}
                        >
                            <span className="flex items-center gap-2">
                                {tab.icon}
                                {tab.label}
                            </span>
                        </button>
                    ))}
                </nav>
            </div>
            <div className="mt-4">{children}</div>
        </div>
    );
};

export const TabPanel: React.FC<{
    value: string;
    activeTab: string;
    children: React.ReactNode;
}> = ({ value, activeTab, children }) => {
    if (value !== activeTab) return null;
    return <div className="animate-fadeIn">{children}</div>;
};