'use client';

import React from 'react';
import { ChatDrawer } from '../../ai/ui';

export const ChatbotDashboard: React.FC = () => {
    return (
        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
            <ChatDrawer
                title="Airy"
                subtitle="Payroll AI Assistant"
                className="h-full min-h-0"
            />
        </div>
    );
};

export default ChatbotDashboard;