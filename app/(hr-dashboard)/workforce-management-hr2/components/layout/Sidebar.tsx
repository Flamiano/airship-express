import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
 BarChart3,
 Clock,
 Calendar,
  FileText,
  UserCheck,
  Building2,
  Package,
  Sparkles,
  Zap,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface NavItem {
 href: string;
 label: string;
 icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
 { href: '/dashboard', label: 'Workforce Analytics', icon: <BarChart3 size={17} /> },
 { href: '/attendance', label: 'Time & Attendance', icon: <Clock size={17} /> },
 { href: '/shifts', label: 'Shifts & Schedules', icon: <Calendar size={17} /> },
 { href: '/timesheets', label: 'Timesheet Workflow', icon: <FileText size={17} /> },
 { href: '/leave', label: 'Leave & Fatigue Rest', icon: <UserCheck size={17} /> },
 { href: '/loads', label: 'Freight Load Dispatch', icon: <Package size={17} /> },
];

interface SidebarProps {
 open: boolean;
 onNavigate: () => void;
 onRunAi: () => void;
 realtimeConnected: boolean;
}

export function Sidebar({ open, onNavigate, onRunAi, realtimeConnected }: SidebarProps) {
 const router = useRouter();
 const { profile } = useAuth();

 return (
 <aside
 className={`fixed lg:static inset-y-0 left-0 z-20 w-64 bg-white border-r border-pink-100 flex flex-col justify-between transition-transform duration-300 ease-in-out ${
 open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
 }`}
 >
 <div className="p-4 space-y-6 overflow-y-auto">
 {/* Terminal indicator */}
 <div className="px-3 py-2 bg-pink-50 rounded-xl border border-pink-100 flex items-center gap-3">
 <div className="p-2 bg-white rounded-lg text-pink-600 shadow-2xs border border-pink-100">
 <Building2 size={18} />
 </div>
 <div>
 <p className="text-xs font-bold text-pink-950">
 {profile?.terminal || 'Chicago Freight Hub'}
 </p>
 <p className="text-[10px] text-pink-500">Workforce Sub-system</p>
 </div>
 </div>

 {/* Navigation */}
 <nav className="space-y-1">
 <p className="px-3 text-[10px] font-bold text-pink-400 uppercase tracking-wider mb-2">
 Core Sub-systems
 </p>
 {NAV_ITEMS.map((item) => {
 const active = router.pathname === item.href;
 return (
 <Link
 key={item.href}
 href={item.href}
 onClick={onNavigate}
 className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
 active
 ? 'bg-pink-600 text-white shadow-md shadow-pink-200'
 : 'text-pink-900 hover:bg-pink-50 '
 }`}
 >
 <div className="flex items-center gap-2.5">
 {item.icon}
 <span>{item.label}</span>
 </div>
 {active && <ChevronRight size={14} />}
 </Link>
 );
 })}
 </nav>

  {/* AI callout */}
  <div className="bg-gradient-to-br from-pink-600 to-pink-700 p-3.5 rounded-2xl text-white shadow-md shadow-pink-200 space-y-2">
    <div className="flex items-center gap-1.5">
      <Sparkles size={16} className="text-pink-200" />
      <span className="text-xs font-bold">Gemini Staffing AI</span>
    </div>
    <p className="text-[11px] text-pink-100 leading-snug">
      Predict Q4 peak freight workload &amp; balance driver shifts.
    </p>
    <button
      onClick={onRunAi}
      className="w-full bg-white text-pink-700 text-xs font-bold py-1.5 px-3 rounded-xl shadow-sm hover:bg-pink-50 transition flex items-center justify-center gap-1.5"
    >
      <Zap size={13} className="fill-pink-600 text-pink-600" />
      <span>Run AI Analysis</span>
    </button>
  </div>
 </div>

 {/* Footer: realtime status */}
 <div className="p-4 border-t border-pink-100">
 <div className="flex items-center justify-between text-xs text-pink-600 font-medium">
 <span>Realtime Socket</span>
 <span
 className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold ${
 realtimeConnected
 ? 'bg-emerald-100 text-emerald-800'
 : 'bg-pink-100 text-pink-700 '
 }`}
 >
 <span
 className={`w-1.5 h-1.5 rounded-full ${
 realtimeConnected ? 'bg-emerald-500 animate-ping' : 'bg-pink-400'
 }`}
 />
 {realtimeConnected ? 'Supabase Active' : 'Connecting…'}
 </span>
 </div>
 </div>
 </aside>
 );
}
