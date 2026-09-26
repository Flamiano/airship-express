'use client';

import '../hrWorkforce.css';
import { AuthProvider } from '../contexts/AuthContext';

export default function WorkforceManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}

