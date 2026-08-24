import React, { useState } from 'react';
import { TopNav } from './TopNav';
import { Sidebar } from './Sidebar';
import { AiInsightsModal } from '@/components/modals/AiInsightsModal';
import { useAiAnalysis } from '@/hooks/useAiAnalysis';

interface DashboardLayoutProps {
 children: React.ReactNode;
 /** Whether the realtime socket is connected (passed from pages using attendance). */
 realtimeConnected?: boolean;
}

/**
 * App shell: top nav + sidebar + main content. Sign-in has been removed, so
 * there is no auth guard — every visitor lands on the dashboard directly. Owns
 * the global AI insights modal so it can be triggered from the sidebar.
 */
export function DashboardLayout({ children, realtimeConnected = false }: DashboardLayoutProps) {
 const [sidebarOpen, setSidebarOpen] = useState(false);
 const [aiModalOpen, setAiModalOpen] = useState(false);
 const ai = useAiAnalysis();

 const handleRunAi = () => {
 setSidebarOpen(false);
 setAiModalOpen(true);
 ai.run();
 };

 return (
 <div className="min-h-screen bg-pink-50/30 text-pink-950 flex flex-col antialiased">
 <TopNav onMenuToggle={() => setSidebarOpen((v) => !v)} />

 <div className="flex flex-1 overflow-hidden">
 {/* Mobile backdrop */}
 {sidebarOpen && (
 <div
 className="fixed inset-0 z-10 bg-pink-950/20 lg:hidden"
 onClick={() => setSidebarOpen(false)}
 />
 )}

 <Sidebar
 open={sidebarOpen}
 onNavigate={() => setSidebarOpen(false)}
 onRunAi={handleRunAi}
 realtimeConnected={realtimeConnected}
 />

 <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6">{children}</main>
 </div>

 <AiInsightsModal
 open={aiModalOpen}
 onClose={() => setAiModalOpen(false)}
 loading={ai.loading}
 analysis={ai.analysis}
 source={ai.source}
 error={ai.error}
 />
 </div>
 );
}
