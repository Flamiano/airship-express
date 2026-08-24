import DashboardPanel from './components/tabs/DashboardPanel';
import IncomingPanel from './components/client/incoming/IncomingPanel';
import SortingPanel from './components/tabs/SortingPanel';
import OutgoingPanel from './components/tabs/OutgoingPanel';
import TabsWrapper from './components/TabsWrapper';
import ManualEntryModal from './components/client/incoming/ManualEntryModal';
import { SessionGuard } from '../../components/server/SessionGuard';

export default function WarehousingPage() {
    return (
        <>
            <SessionGuard requiredRole={['Admin', 'Manager', 'Operator', 'Executive']}>
                <div className="p-6 space-y-6 fade-in">
                    <div className="card">
                        <TabsWrapper>
                            <div data-panel="dashboard">
                                <DashboardPanel />
                            </div>
                            <div data-panel="incoming">
                                <IncomingPanel />
                            </div>
                            <div data-panel="sorting">
                                <SortingPanel />
                            </div>
                            <div data-panel="outgoing">
                                <OutgoingPanel />
                            </div>
                        </TabsWrapper>
                    </div>
                </div>
                <ManualEntryModal />
            </SessionGuard>
        </>
    );
}