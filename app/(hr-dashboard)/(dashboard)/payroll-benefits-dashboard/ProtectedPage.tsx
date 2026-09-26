'use client';

import { ReactNode } from 'react';
import { withHRProtection } from '@/app/(hr-dashboard)/hocs/withHRProtection';

function Passthrough({ children }: { children: ReactNode }) {
    return <>{children}</>;
}

const ProtectedWrapper = withHRProtection(Passthrough);

export default function ProtectedPage({ children }: { children: ReactNode }) {
    return <ProtectedWrapper>{children}</ProtectedWrapper>;
}