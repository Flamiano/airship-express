'use client';

import '../hrWorkforce.css';
import { AuthProvider } from '../contexts/AuthContext';

import { DashboardLayout } from '../components/layout/DashboardLayout';

export default function WorkforceManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <DashboardLayout>
        {children}
      </DashboardLayout>
    </AuthProvider>
  );
}

