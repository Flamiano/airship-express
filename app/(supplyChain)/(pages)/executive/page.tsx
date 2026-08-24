// app/(supplyChain)/(pages)/executive/page.tsx
import { SessionGuard } from '@/app/(supplyChain)/components/server/SessionGuard';
import ExecutiveClientPage from './components/ExecutiveClientPage';

export default function Home() {
  return (
    <SessionGuard requiredRole={['Admin', 'Executive']}>
      <ExecutiveClientPage />
    </SessionGuard>
  );
}