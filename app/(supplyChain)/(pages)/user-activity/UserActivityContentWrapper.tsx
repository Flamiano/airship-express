'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useUserActivity } from './hooks/useUserActivity';
import { useDebounce } from '../../hooks/useDebounce';
import { ActivityTab, Appeal } from './types';

import { HeaderStats } from './components/common/HeaderStats';
import { TabNav } from './components/common/TabNav';
import { ActiveUsersTab } from './components/tabs/ActiveUsersTab';
import { SessionsTab } from './components/tabs/SessionsTab';
import { AccessControlTab } from './components/tabs/AccessControlTab';
import { BlockedDevicesTab } from './components/tabs/BlockedDevicesTab';
import { AppealsTab } from './components/tabs/AppealsTab';
import { ActivityLogTab } from './components/tabs/ActivityLogTab';
import { CreateAccountTab } from './components/tabs/CreateAccountTab';
import { AppealResponseModal } from './components/modals/AppealResponseModal';

export default function UserActivityContentWrapper() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const validTabs: ActivityTab[] = ['active_users', 'create_account', 'sessions', 'access_control', 'blocked', 'appeals', 'activity'];
    const tabParam = searchParams.get('tab') as ActivityTab;
    const initialTab = tabParam && validTabs.includes(tabParam) ? tabParam : 'active_users';
    const [activeTab, setActiveTab] = useState<ActivityTab>(initialTab);
    const [employeeAccountsCount, setEmployeeAccountsCount] = useState<number>(0);

    // Initial fetch of employee accounts count
    useEffect(() => {
        fetch('/api/supplyChain/employee-accounts')
            .then(res => res.json())
            .then(data => {
                if (data.success && typeof data.total === 'number') {
                    setEmployeeAccountsCount(data.total);
                }
            })
            .catch(() => {});
    }, []);

    // Sync activeTab when searchParams change (browser back/forward or direct navigation)
    useEffect(() => {
        const currentParam = searchParams.get('tab') as ActivityTab;
        if (currentParam && validTabs.includes(currentParam)) {
            setActiveTab(prev => (prev !== currentParam ? currentParam : prev));
        }
    }, [searchParams]);

    // search and filters
    const [searchTerm, setSearchTerm] = useState('');
    const editEmailParam = searchParams.get('edit_email') || searchParams.get('edit_user') || searchParams.get('search');
    const [accessControlSearchTerm, setAccessControlSearchTerm] = useState(editEmailParam || '');
    const [activeUserSearchTerm, setActiveUserSearchTerm] = useState('');
    const [blockedSearchTerm, setBlockedSearchTerm] = useState('');
    const [appealSearchTerm, setAppealSearchTerm] = useState('');
    const [appealStatusFilter, setAppealStatusFilter] = useState('all');
    const [activitySearchTerm, setActivitySearchTerm] = useState('');
    const [activityFilter, setActivityFilter] = useState<string>('all');

    useEffect(() => {
        if (editEmailParam) {
            setAccessControlSearchTerm(editEmailParam);
        }
    }, [editEmailParam]);

    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const debouncedAccessControlSearchTerm = useDebounce(accessControlSearchTerm, 300);
    const debouncedActiveUserSearchTerm = useDebounce(activeUserSearchTerm, 300);
    const debouncedBlockedSearchTerm = useDebounce(blockedSearchTerm, 300);
    const debouncedAppealSearchTerm = useDebounce(appealSearchTerm, 300);
    const debouncedActivitySearchTerm = useDebounce(activitySearchTerm, 300);

    // appeal response modal
    const [showResponseModal, setShowResponseModal] = useState(false);
    const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null);
    const [responseMessage, setResponseMessage] = useState('');

    const {
        sessions,
        filteredSessions,
        accessControlList,
        filteredAccessControl,
        activeUsers,
        filteredActiveUsers,
        blockedDevices,
        filteredBlockedDevices,
        activities,
        filteredActivities,
        appeals,
        filteredAppeals,
        isLoading,
        isRefreshing,
        isRealtimeActive,
        userRole,
        queuedUsersCount,
        queuedRolesCount,
        slotStats,

        // Action loading states
        blockingSessionId,
        isBulkBlockingSessions,
        isBulkDeletingSessions,
        unblockingDeviceId,
        deletingDeviceId,
        isBulkUnblockingDevices,
        isBulkDeletingDevices,
        approvingAppealId,
        rejectingAppealId,
        deletingAppealId,
        isBulkApprovingAppeals,
        isBulkRejectingAppeals,
        isBulkDeletingAppeals,
        terminatingSessionId,
        isBulkTerminating,
        isBulkDeletingActivities,

        selectedSessions,
        setSelectedSessions,
        selectedActiveUsers,
        setSelectedActiveUsers,
        selectedBlockedDevices,
        setSelectedBlockedDevices,
        selectedAppeals,
        setSelectedAppeals,
        selectedActivities,
        setSelectedActivities,

        sessionPage,
        setSessionPage,
        accessControlPage,
        setAccessControlPage,
        activeUserPage,
        setActiveUserPage,
        blockedPage,
        setBlockedPage,
        appealPage,
        setAppealPage,
        activityPage,
        setActivityPage,

        sessionTotalPages,
        accessControlTotalPages,
        activeUserTotalPages,
        blockedTotalPages,
        appealTotalPages,
        activityTotalPages,

        getPaginatedData,
        filterSessions,
        filterAccessControl,
        filterActiveUsers,
        filterBlockedDevices,
        filterAppeals,
        filterActivities,
        fetchAllData,
        fetchSessions,

        handleUpdateAccessRule,
        handleBulkUpdateAccessRules,
        handleBlockDevice,
        handleResetStrikes,
        handleUnblockDevice,
        handleDeleteDevice,
        handleApproveAppeal,
        handleRejectAppeal,
        handleDeleteAppeal,
        handleSendResponse,
        handleTerminateSession,

        handleBulkBlock,
        handleBulkUnblock,
        handleBulkDeleteBlocked,
        handleBulkDeleteSessions,
        handleBulkTerminateActiveUsers,
        handleBulkDeleteActivities,
        handleBulkDeleteAppeals,
        handleBulkApproveAppeals,
        handleBulkRejectAppeals,
    } = useUserActivity();

    // unique action types for activity log filter
    const uniqueActions = Array.from(new Set(activities.map(a => a.action)));

    const handleTabChange = (tab: ActivityTab) => {
        setActiveTab(tab);
        if (tab === 'active_users') setActiveUserPage(1);
        else if (tab === 'sessions') setSessionPage(1);
        else if (tab === 'access_control') setAccessControlPage(1);
        else if (tab === 'blocked') setBlockedPage(1);
        else if (tab === 'appeals') setAppealPage(1);
        else if (tab === 'activity') setActivityPage(1);

        setSelectedActiveUsers(new Set());
        setSelectedSessions(new Set());
        setSelectedBlockedDevices(new Set());
        setSelectedAppeals(new Set());
        setSelectedActivities(new Set());

        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', tab);
        router.replace(`?${params.toString()}`, { scroll: false });
    };

    // filter access control on debounced search
    useEffect(() => {
        filterAccessControl(debouncedAccessControlSearchTerm);
        setAccessControlPage(1);
    }, [debouncedAccessControlSearchTerm, filterAccessControl, setAccessControlPage]);

    // filter active users on debounced search
    useEffect(() => {
        filterActiveUsers(debouncedActiveUserSearchTerm);
        setActiveUserPage(1);
    }, [debouncedActiveUserSearchTerm, filterActiveUsers, setActiveUserPage]);

    // filter sessions on debounced search
    useEffect(() => {
        filterSessions(debouncedSearchTerm);
        setSessionPage(1);
    }, [debouncedSearchTerm, filterSessions, setSessionPage]);

    // filter blocked devices on debounced search
    useEffect(() => {
        filterBlockedDevices(debouncedBlockedSearchTerm);
        setBlockedPage(1);
    }, [debouncedBlockedSearchTerm, filterBlockedDevices, setBlockedPage]);

    // filter appeals on debounced search or filter
    useEffect(() => {
        filterAppeals(debouncedAppealSearchTerm, appealStatusFilter);
        setAppealPage(1);
    }, [debouncedAppealSearchTerm, appealStatusFilter, filterAppeals, setAppealPage]);

    // filter activity logs on debounced search or filter
    useEffect(() => {
        filterActivities(debouncedActivitySearchTerm, activityFilter);
        setActivityPage(1);
    }, [debouncedActivitySearchTerm, activityFilter, filterActivities, setActivityPage]);

    // selection handlers for active users
    const handleToggleSelectActiveUser = (id: string, isProtected: boolean) => {
        if (isProtected) return;
        const next = new Set(selectedActiveUsers);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedActiveUsers(next);
    };

    const handleSelectAllActiveUsers = () => {
        const isProtectedRole = (role?: string) => {
            const normalized = (role || '').toLowerCase();
            return ['executive', 'admin', 'manager'].includes(normalized);
        };
        const selectableUsers = filteredActiveUsers.filter(s => !isProtectedRole(s.users?.role));
        if (selectedActiveUsers.size === selectableUsers.length) {
            setSelectedActiveUsers(new Set());
        } else {
            setSelectedActiveUsers(new Set(selectableUsers.map(s => s.id)));
        }
    };

    // selection handlers
    const handleToggleSelectSession = (id: string, isDisabled: boolean) => {
        if (isDisabled) return;
        const next = new Set(selectedSessions);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedSessions(next);
    };

    const handleSelectAllSessions = () => {
        const selectableSessions = filteredSessions.filter(
            s => !s.is_blocked && s.users?.role !== 'Admin' && s.users?.role !== 'Executive'
        );
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
        const paginated = getPaginatedData(filteredBlockedDevices, blockedPage);
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
        const paginated = getPaginatedData(filteredAppeals, appealPage);
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

    const paginatedActiveUsers = getPaginatedData(filteredActiveUsers, activeUserPage);
    const paginatedSessions = getPaginatedData(filteredSessions, sessionPage);
    const paginatedAccessControl = getPaginatedData(filteredAccessControl, accessControlPage);
    const paginatedBlockedDevices = getPaginatedData(filteredBlockedDevices, blockedPage);
    const paginatedAppeals = getPaginatedData(filteredAppeals, appealPage);
    const paginatedActivities = getPaginatedData(filteredActivities, activityPage);

    const pendingAuthCount = accessControlList.filter(s => s.auth_requested).length;

    if (userRole && !['Admin', 'Executive'].includes(userRole)) {
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
        <div className="p-6 space-y-6 animate-in fade-in duration-300 bgCard">
            {/* header & quick stat badges */}
            <HeaderStats
                blockedDevices={blockedDevices}
                appeals={appeals}
                activities={activities}
                isRealtimeActive={isRealtimeActive}
                isRefreshing={isRefreshing}
                onRefresh={() => fetchAllData(true)}
            />

            {/* navigation tabs */}
            <TabNav
                activeTab={activeTab}
                onTabChange={handleTabChange}
                activeUsersCount={activeUsers.length}
                sessionsCount={sessions.length}
                accessControlCount={accessControlList.length}
                pendingAuthCount={pendingAuthCount}
                blockedCount={blockedDevices.length}
                appealsCount={appeals.length}
                activitiesCount={activities.length}
                employeeAccountsCount={employeeAccountsCount}
            />

            {/* active tab view */}
            {activeTab === 'active_users' && (
                <ActiveUsersTab
                    activeUsers={paginatedActiveUsers}
                    isLoading={isLoading}
                    searchTerm={activeUserSearchTerm}
                    onSearchTermChange={setActiveUserSearchTerm}
                    selectedActiveUsers={selectedActiveUsers}
                    onToggleSelectActiveUser={handleToggleSelectActiveUser}
                    onSelectAllActiveUsers={handleSelectAllActiveUsers}
                    onTerminateSession={handleTerminateSession}
                    onBulkTerminate={handleBulkTerminateActiveUsers}
                    currentPage={activeUserPage}
                    totalPages={activeUserTotalPages}
                    onPageChange={setActiveUserPage}
                    userRole={userRole}
                    queuedUsersCount={queuedUsersCount}
                    queuedRolesCount={queuedRolesCount}
                    slotStats={slotStats}
                    terminatingSessionId={terminatingSessionId}
                    isBulkTerminating={isBulkTerminating}
                />
            )}

            {activeTab === 'create_account' && (
                <CreateAccountTab
                    onAccountsCountChange={setEmployeeAccountsCount}
                />
            )}

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
                    blockingSessionId={blockingSessionId}
                    isBulkBlocking={isBulkBlockingSessions}
                    isBulkDeleting={isBulkDeletingSessions}
                />
            )}

            {activeTab === 'access_control' && (
                <AccessControlTab
                    sessions={accessControlList}
                    isLoading={isLoading}
                    searchTerm={accessControlSearchTerm}
                    onSearchTermChange={setAccessControlSearchTerm}
                    onUpdateAccessRule={handleUpdateAccessRule}
                    onSaveBulk={handleBulkUpdateAccessRules}
                    userRole={userRole}
                    isRealtimeActive={isRealtimeActive}
                    onRefresh={() => fetchSessions(true)}
                />
            )}

            {activeTab === 'blocked' && (
                <BlockedDevicesTab
                    devices={paginatedBlockedDevices}
                    isLoading={isLoading}
                    searchTerm={blockedSearchTerm}
                    onSearchTermChange={setBlockedSearchTerm}
                    isRealtimeActive={isRealtimeActive}
                    onRefresh={() => fetchAllData(true)}
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
                    unblockingDeviceId={unblockingDeviceId}
                    deletingDeviceId={deletingDeviceId}
                    isBulkUnblocking={isBulkUnblockingDevices}
                    isBulkDeleting={isBulkDeletingDevices}
                />
            )}

            {activeTab === 'appeals' && (
                <AppealsTab
                    appeals={paginatedAppeals}
                    isLoading={isLoading}
                    searchTerm={appealSearchTerm}
                    onSearchTermChange={setAppealSearchTerm}
                    statusFilter={appealStatusFilter}
                    onStatusFilterChange={setAppealStatusFilter}
                    isRealtimeActive={isRealtimeActive}
                    onRefresh={() => fetchAllData(true)}
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
                    approvingAppealId={approvingAppealId}
                    rejectingAppealId={rejectingAppealId}
                    deletingAppealId={deletingAppealId}
                    isBulkApproving={isBulkApprovingAppeals}
                    isBulkRejecting={isBulkRejectingAppeals}
                    isBulkDeleting={isBulkDeletingAppeals}
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
                    isBulkDeleting={isBulkDeletingActivities}
                    isRealtimeActive={isRealtimeActive}
                    onRefresh={() => fetchAllData(true)}
                />
            )}

            {/* appeal response modal */}
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
