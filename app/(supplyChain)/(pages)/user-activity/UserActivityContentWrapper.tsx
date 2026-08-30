'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useUserActivity } from './hooks/useUserActivity';
import { useDebounce } from '@/app/(supplyChain)/hooks/useDebounce';
import { ActivityTab, Appeal } from './types';

import { HeaderStats } from './components/common/HeaderStats';
import { TabNav } from './components/common/TabNav';
import { SessionsTab } from './components/tabs/SessionsTab';
import { BlockedDevicesTab } from './components/tabs/BlockedDevicesTab';
import { AppealsTab } from './components/tabs/AppealsTab';
import { ActivityLogTab } from './components/tabs/ActivityLogTab';
import { AppealResponseModal } from './components/modals/AppealResponseModal';

export default function UserActivityContentWrapper() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const initialTab = (searchParams.get('tab') as ActivityTab) || 'sessions';
    const [activeTab, setActiveTab] = useState<ActivityTab>(initialTab);

    // Search and filters
    const [searchTerm, setSearchTerm] = useState('');
    const [activitySearchTerm, setActivitySearchTerm] = useState('');
    const [activityFilter, setActivityFilter] = useState<string>('all');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const debouncedActivitySearchTerm = useDebounce(activitySearchTerm, 300);

    // Appeal response modal
    const [showResponseModal, setShowResponseModal] = useState(false);
    const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null);
    const [responseMessage, setResponseMessage] = useState('');

    const {
        sessions,
        filteredSessions,
        blockedDevices,
        activities,
        filteredActivities,
        appeals,
        isLoading,
        userRole,

        selectedSessions,
        setSelectedSessions,
        selectedBlockedDevices,
        setSelectedBlockedDevices,
        selectedAppeals,
        setSelectedAppeals,
        selectedActivities,
        setSelectedActivities,

        sessionPage,
        setSessionPage,
        blockedPage,
        setBlockedPage,
        appealPage,
        setAppealPage,
        activityPage,
        setActivityPage,

        sessionTotalPages,
        blockedTotalPages,
        appealTotalPages,
        activityTotalPages,

        getPaginatedData,
        filterSessions,
        filterActivities,

        handleBlockDevice,
        handleResetStrikes,
        handleUnblockDevice,
        handleDeleteDevice,
        handleApproveAppeal,
        handleRejectAppeal,
        handleDeleteAppeal,
        handleSendResponse,

        handleBulkBlock,
        handleBulkUnblock,
        handleBulkDeleteBlocked,
        handleBulkDeleteSessions,
        handleBulkDeleteActivities,
        handleBulkDeleteAppeals,
        handleBulkApproveAppeals,
        handleBulkRejectAppeals,
    } = useUserActivity();

    // Unique action types for activity log filter
    const uniqueActions = Array.from(new Set(activities.map(a => a.action)));

    const handleTabChange = (tab: ActivityTab) => {
        setActiveTab(tab);
        if (tab === 'sessions') setSessionPage(1);
        else if (tab === 'blocked') setBlockedPage(1);
        else if (tab === 'appeals') setAppealPage(1);
        else if (tab === 'activity') setActivityPage(1);

        setSelectedSessions(new Set());
        setSelectedBlockedDevices(new Set());
        setSelectedAppeals(new Set());
        setSelectedActivities(new Set());
        router.push(`?tab=${tab}`, { scroll: false });
    };

    // Filter sessions on debounced search
    useEffect(() => {
        if (activeTab === 'sessions') {
            filterSessions(debouncedSearchTerm);
        }
    }, [debouncedSearchTerm, activeTab, filterSessions]);

    // Filter activity logs on debounced search or filter
    useEffect(() => {
        if (activeTab === 'activity') {
            filterActivities(debouncedActivitySearchTerm, activityFilter);
        }
    }, [debouncedActivitySearchTerm, activityFilter, activeTab, filterActivities]);

    // Selection handlers
    const handleToggleSelectSession = (id: string, isDisabled: boolean) => {
        if (isDisabled) return;
        const next = new Set(selectedSessions);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedSessions(next);
    };

    const handleSelectAllSessions = () => {
        const selectableSessions = filteredSessions.filter(s => !s.is_blocked && s.users?.role !== 'Admin');
        if (selectedSessions.size === selectableSessions.length) {
            setSelectedSessions(new Set());
        } else {
            setSelectedSessions(new Set(selectableSessions.map(s => s.id)));
        }
    };

    const handleToggleSelectBlocked = (id: string) => {
        const next = new Set(selectedBlockedDevices);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedBlockedDevices(next);
    };

    const handleSelectAllBlocked = () => {
        const paginated = getPaginatedData(blockedDevices, blockedPage);
        if (selectedBlockedDevices.size === paginated.length) {
            setSelectedBlockedDevices(new Set());
        } else {
            setSelectedBlockedDevices(new Set(paginated.map(d => d.id)));
        }
    };

    const handleToggleSelectAppeal = (id: string) => {
        const next = new Set(selectedAppeals);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedAppeals(next);
    };

    const handleSelectAllAppeals = () => {
        const paginated = getPaginatedData(appeals, appealPage);
        if (selectedAppeals.size === paginated.length) {
            setSelectedAppeals(new Set());
        } else {
            setSelectedAppeals(new Set(paginated.map(a => a.id)));
        }
    };

    const handleToggleSelectActivity = (id: number) => {
        const next = new Set(selectedActivities);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedActivities(next);
    };

    const handleSelectAllActivities = () => {
        const paginated = getPaginatedData(filteredActivities, activityPage);
        if (selectedActivities.size === paginated.length) {
            setSelectedActivities(new Set());
        } else {
            setSelectedActivities(new Set(paginated.map(a => a.id)));
        }
    };

    const handleOpenResponseModal = (appeal: Appeal) => {
        setSelectedAppeal(appeal);
        setResponseMessage(appeal.response_message || '');
        setShowResponseModal(true);
    };

    const handleModalSendResponse = async () => {
        if (!selectedAppeal) return;
        const success = await handleSendResponse(selectedAppeal, responseMessage);
        if (success) {
            setShowResponseModal(false);
            setSelectedAppeal(null);
            setResponseMessage('');
        }
    };

    const paginatedSessions = getPaginatedData(filteredSessions, sessionPage);
    const paginatedBlockedDevices = getPaginatedData(blockedDevices, blockedPage);
    const paginatedAppeals = getPaginatedData(appeals, appealPage);
    const paginatedActivities = getPaginatedData(filteredActivities, activityPage);

    if (userRole && userRole !== 'Admin') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
                <div className="text-center">
                    <div className="text-6xl mb-4">🔒</div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Access Denied</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">You need administrator privileges to view this page.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6  animate-in fade-in duration-300 bgCard">
            {/* Header & Quick Stat Badges */}
            <HeaderStats
                blockedDevices={blockedDevices}
                appeals={appeals}
                activities={activities}
            />

            {/* Navigation Tabs */}
            <TabNav
                activeTab={activeTab}
                onTabChange={handleTabChange}
                sessionsCount={sessions.length}
                blockedCount={blockedDevices.length}
                appealsCount={appeals.length}
                activitiesCount={activities.length}
            />

            {/* Active Tab View */}
            {activeTab === 'sessions' && (
                <SessionsTab
                    sessions={paginatedSessions}
                    isLoading={isLoading}
                    searchTerm={searchTerm}
                    onSearchTermChange={setSearchTerm}
                    selectedSessions={selectedSessions}
                    onToggleSelectSession={handleToggleSelectSession}
                    onSelectAllSessions={handleSelectAllSessions}
                    onBlockDevice={handleBlockDevice}
                    onResetStrikes={handleResetStrikes}
                    onBulkBlock={handleBulkBlock}
                    onBulkDelete={handleBulkDeleteSessions}
                    currentPage={sessionPage}
                    totalPages={sessionTotalPages}
                    onPageChange={setSessionPage}
                />
            )}

            {activeTab === 'blocked' && (
                <BlockedDevicesTab
                    devices={paginatedBlockedDevices}
                    isLoading={isLoading}
                    selectedDevices={selectedBlockedDevices}
                    onToggleSelectDevice={handleToggleSelectBlocked}
                    onSelectAllDevices={handleSelectAllBlocked}
                    onUnblockDevice={handleUnblockDevice}
                    onDeleteDevice={handleDeleteDevice}
                    onBulkUnblock={handleBulkUnblock}
                    onBulkDelete={handleBulkDeleteBlocked}
                    currentPage={blockedPage}
                    totalPages={blockedTotalPages}
                    onPageChange={setBlockedPage}
                />
            )}

            {activeTab === 'appeals' && (
                <AppealsTab
                    appeals={paginatedAppeals}
                    isLoading={isLoading}
                    selectedAppeals={selectedAppeals}
                    onToggleSelectAppeal={handleToggleSelectAppeal}
                    onSelectAllAppeals={handleSelectAllAppeals}
                    onApproveAppeal={handleApproveAppeal}
                    onRejectAppeal={handleRejectAppeal}
                    onDeleteAppeal={handleDeleteAppeal}
                    onOpenResponseModal={handleOpenResponseModal}
                    onBulkApprove={handleBulkApproveAppeals}
                    onBulkReject={handleBulkRejectAppeals}
                    onBulkDelete={handleBulkDeleteAppeals}
                    currentPage={appealPage}
                    totalPages={appealTotalPages}
                    onPageChange={setAppealPage}
                />
            )}

            {activeTab === 'activity' && (
                <ActivityLogTab
                    activities={paginatedActivities}
                    isLoading={isLoading}
                    searchTerm={activitySearchTerm}
                    onSearchTermChange={setActivitySearchTerm}
                    filter={activityFilter}
                    onFilterChange={setActivityFilter}
                    uniqueActions={uniqueActions}
                    selectedActivities={selectedActivities}
                    onToggleSelectActivity={handleToggleSelectActivity}
                    onSelectAllActivities={handleSelectAllActivities}
                    onBulkDelete={handleBulkDeleteActivities}
                    currentPage={activityPage}
                    totalPages={activityTotalPages}
                    onPageChange={setActivityPage}
                />
            )}

            {/* Appeal Response Modal */}
            <AppealResponseModal
                isOpen={showResponseModal}
                appeal={selectedAppeal}
                responseMessage={responseMessage}
                onResponseMessageChange={setResponseMessage}
                onClose={() => {
                    setShowResponseModal(false);
                    setSelectedAppeal(null);
                    setResponseMessage('');
                }}
                onSendResponse={handleModalSendResponse}
            />
        </div>
    );
}
