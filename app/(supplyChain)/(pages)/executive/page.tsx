import { SessionGuard } from '@/app/(supplyChain)/components/server/SessionGuard';
import ExecutiveClientPage from './components/ExecutiveClientPage';

export default function Home() {
  return (
    <SessionGuard requiredRole={['Executive']}>
      <ExecutiveClientPage />
    </SessionGuard>
  );
}