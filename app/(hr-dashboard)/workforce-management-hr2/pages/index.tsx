import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { RefreshCw } from 'lucide-react';

/** Entry point: always routes to the dashboard (sign-in has been removed). */
export default function Home() {
 const router = useRouter();

 useEffect(() => {
 router.replace('/dashboard');
 }, [router]);

 return (
 <div className="min-h-screen flex items-center justify-center bg-pink-50">
 <RefreshCw size={28} className="animate-spin text-pink-600" />
 </div>
 );
}
