import React, { useState, useEffect } from 'react';
import { Clock, Radio, Key, CheckCircle, AlertCircle, RefreshCw, LogIn, LogOut, ArrowRightCircle } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { useRealtimeAttendance } from '@/hooks/useRealtime';
import { useAuth } from '@/hooks/useAuth';
import { ATTENDANCE_BADGE } from '@/utils/constants';
import { canManageAttendance } from '@/utils/rbac';
import { apiFetch } from '@/lib/apiFetch';
import type { AttendanceLog, AttendanceStatus, Employee } from '@/types/workforce';

const FASTAPI_URL = 'http://localhost:8000';

export default function AttendancePage() {
  const { attendance, connected, refetch } = useRealtimeAttendance();
  const { role } = useAuth();
  const [filter, setFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'live_scans' | 'roster'>('live_scans');
  const [profiles, setProfiles] = useState<Employee[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);

  // RFID Pairing Modal State
  const [pairingModalOpen, setPairingModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [isWaitingForCard, setIsWaitingForCard] = useState(false);
  const [pairingStatusMsg, setPairingStatusMsg] = useState<string | null>(null);
  const [pairedSuccessUid, setPairedSuccessUid] = useState<string | null>(null);
  const [hwOnline, setHwOnline] = useState(true);

  // Load all 61 real roster profiles from Supabase
  const loadProfiles = async () => {
    try {
      setLoadingProfiles(true);
      const data = await apiFetch<Employee[]>('/api/profiles');
      setProfiles(data || []);
    } catch (err) {
      console.error('Failed to load profiles:', err);
    } finally {
      setLoadingProfiles(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  // Check hardware gateway status
  useEffect(() => {
    async function checkGateway() {
      try {
        const res = await fetch(`${FASTAPI_URL}/health-check`);
        setHwOnline(res.ok);
      } catch {
        setHwOnline(false);
      }
    }
    checkGateway();
    const interval = setInterval(checkGateway, 8000);
    return () => clearInterval(interval);
  }, []);

  // Poll for card tap when pairing modal is active
  useEffect(() => {
    if (!isWaitingForCard || !selectedEmployee) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`${FASTAPI_URL}/api/v1/registration/status`);
        if (res.ok) {
          const data = await res.json();
          if (!data.is_active && data.captured_uid) {
            // Card was tapped and captured!
            setPairedSuccessUid(data.captured_uid);
            setIsWaitingForCard(false);
            setPairingStatusMsg(`Card [${data.captured_uid}] successfully paired with ${selectedEmployee.full_name}!`);
            loadProfiles();
            refetch();
          }
        }
      } catch (err) {
        console.error('Registration polling error:', err);
      }
    }, 800);

    return () => clearInterval(pollInterval);
  }, [isWaitingForCard, selectedEmployee, refetch]);

  const startPairing = async (emp: any) => {
    setSelectedEmployee(emp);
    setPairingModalOpen(true);
    setPairedSuccessUid(null);
    setIsWaitingForCard(true);
    setPairingStatusMsg(`Waiting for physical card tap on ESP32 Terminal...`);

    try {
      const url = `${FASTAPI_URL}/api/v1/registration/start?employee_id=${encodeURIComponent(emp.id)}&full_name=${encodeURIComponent(emp.full_name)}&department=${encodeURIComponent(emp.role || 'Staff')}&position=${encodeURIComponent(emp.role || 'Staff')}`;
      await fetch(url, { method: 'POST' });
    } catch (err) {
      setPairingStatusMsg('Could not connect to FastAPI Edge Gateway.');
    }
  };

  const cancelPairing = async () => {
    try {
      await fetch(`${FASTAPI_URL}/api/v1/registration/cancel`, { method: 'POST' });
    } catch {}
    setIsWaitingForCard(false);
    setPairingModalOpen(false);
    setSelectedEmployee(null);
  };

  const cycleStatus = async (log: AttendanceLog) => {
    if (!canManageAttendance(role)) return;
    const order: AttendanceStatus[] = ['On-Shift', 'On-Break', 'Tardy', 'Absent', 'Clocked Out'];
    const next = order[(order.indexOf(log.status) + 1) % order.length];
    try {
      await apiFetch<AttendanceLog>('/api/attendance', {
        method: 'PATCH',
        body: JSON.stringify({ id: log.id, status: next }),
      });
      refetch();
    } catch {}
  };

  // Filtered live scans
  const filteredScans = attendance.filter((a) =>
    (a.employee?.full_name ?? '').toLowerCase().includes(filter.toLowerCase()) ||
    (a.employee?.role ?? '').toLowerCase().includes(filter.toLowerCase())
  );

  // Filtered roster employees
  const filteredRoster = profiles.filter((p) =>
    (p.full_name ?? '').toLowerCase().includes(filter.toLowerCase()) ||
    (p.role ?? '').toLowerCase().includes(filter.toLowerCase()) ||
    (p.email ?? '').toLowerCase().includes(filter.toLowerCase())
  );

  // Stats calculation
  const onShiftCount = attendance.filter((a) => a.status === 'On-Shift').length;
  const onBreakCount = attendance.filter((a) => a.status === 'On-Break').length;
  const tardyCount = attendance.filter((a) => a.status === 'Tardy').length;

  return (
    <DashboardLayout realtimeConnected={connected}>
      {/* Top Header with Edge Hardware Status Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-pink-100 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-pink-950">Time & Attendance System</h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                hwOnline
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              <Radio size={13} className={hwOnline ? 'animate-pulse text-emerald-600' : ''} />
              {hwOnline ? 'ESP32 Node 01 Online' : 'ESP32 Gateway Offline'}
            </span>
          </div>
          <p className="text-xs text-pink-600 mt-1">
            Real-time biometric & RFID terminal scanner logs synced to Supabase database.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => { refetch(); loadProfiles(); }}
            variant="secondary"
            className="flex items-center gap-1.5 text-xs py-2 px-3 bg-pink-50 text-pink-900 border-pink-200"
          >
            <RefreshCw size={14} /> Refresh
          </Button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-emerald-200 p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">On-Shift Active</p>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          </div>
          <p className="text-2xl font-bold text-emerald-950 mt-1">{onShiftCount}</p>
        </div>
        <div className="bg-white border border-pink-200 p-4 rounded-2xl shadow-sm">
          <p className="text-xs font-bold text-pink-700 uppercase tracking-wider">On Break</p>
          <p className="text-2xl font-bold text-pink-950 mt-1">{onBreakCount}</p>
        </div>
        <div className="bg-white border border-rose-200 p-4 rounded-2xl shadow-sm">
          <p className="text-xs font-bold text-rose-700 uppercase tracking-wider">Tardy / Late</p>
          <p className="text-2xl font-bold text-rose-600 mt-1">{tardyCount}</p>
        </div>
        <div className="bg-white border border-indigo-200 p-4 rounded-2xl shadow-sm">
          <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Total Roster</p>
          <p className="text-2xl font-bold text-indigo-950 mt-1">{profiles.length}</p>
        </div>
      </div>

      {/* RFID Card Pairing Modal */}
      {pairingModalOpen && selectedEmployee && (
        <div className="fixed inset-0 z-50 bg-pink-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-pink-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-pink-100 pb-3">
              <div className="flex items-center gap-2 text-pink-950 font-bold text-base">
                <Key className="text-pink-600" size={20} />
                <h3>Assign RFID Card</h3>
              </div>
              <button
                onClick={cancelPairing}
                className="text-pink-400 hover:text-pink-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="text-center py-4 space-y-3">
              <div className="w-16 h-16 rounded-full bg-pink-100 text-pink-800 font-bold text-xl flex items-center justify-center mx-auto shadow-inner">
                {selectedEmployee.avatar_initials || '👤'}
              </div>
              <div>
                <h4 className="font-bold text-pink-950 text-base">{selectedEmployee.full_name}</h4>
                <p className="text-xs text-pink-600">{selectedEmployee.role} • {selectedEmployee.terminal || 'Manila Hub'}</p>
              </div>

              {isWaitingForCard ? (
                <div className="bg-pink-50 border-2 border-dashed border-pink-300 rounded-2xl p-5 space-y-2 animate-pulse">
                  <div className="text-2xl">📲</div>
                  <p className="font-bold text-pink-950 text-sm">TAP RFID CARD ON ESP32 READER</p>
                  <p className="text-xs text-pink-600">The hardware antenna will instantly capture and assign the tag UID to this employee.</p>
                </div>
              ) : pairedSuccessUid ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-1">
                  <div className="flex items-center justify-center gap-1.5 text-emerald-700 font-bold text-sm">
                    <CheckCircle size={18} /> Card Linked Successfully!
                  </div>
                  <p className="font-mono text-xs text-emerald-800 font-bold">UID: {pairedSuccessUid}</p>
                </div>
              ) : null}

              {pairingStatusMsg && (
                <p className="text-xs text-pink-800 font-medium">{pairingStatusMsg}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-pink-100 pt-3">
              <Button variant="secondary" onClick={cancelPairing} className="text-xs">
                {pairedSuccessUid ? 'Done' : 'Cancel'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Terminal Activity Card with Tabs */}
      <Card className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-pink-100 pb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('live_scans')}
              className={`text-xs sm:text-sm font-bold px-3.5 py-1.5 rounded-xl transition ${
                activeTab === 'live_scans'
                  ? 'bg-pink-600 text-white shadow-sm'
                  : 'text-pink-700 hover:bg-pink-50'
              }`}
            >
              ⏱️ Live Terminal Activity ({filteredScans.length})
            </button>
            <button
              onClick={() => setActiveTab('roster')}
              className={`text-xs sm:text-sm font-bold px-3.5 py-1.5 rounded-xl transition ${
                activeTab === 'roster'
                  ? 'bg-pink-600 text-white shadow-sm'
                  : 'text-pink-700 hover:bg-pink-50'
              }`}
            >
              👥 Employee Roster & RFID Keys ({filteredRoster.length})
            </button>
          </div>

          <input
            type="text"
            placeholder="Search employee, role, or ID..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="text-xs bg-pink-50 border border-pink-200 rounded-lg px-3 py-1.5 text-pink-950 focus:outline-none focus:ring-2 focus:ring-pink-400 w-full sm:w-64"
          />
        </div>

        {/* TAB 1: LIVE SCAN LOGS WITH DEDICATED TIME-IN AND TIME-OUT */}
        {activeTab === 'live_scans' && (
          <Table>
            <THead>
              <TR header>
                <TH>Employee</TH>
                <TH>Role & Terminal</TH>
                <TH>Device Station</TH>
                <TH>Time In</TH>
                <TH>Time Out</TH>
                <TH>Status</TH>
                <TH className="text-right">Action</TH>
              </TR>
            </THead>
            <TBody>
              {filteredScans.map((row) => (
                <TR key={row.id}>
                  <TD className="font-bold text-pink-950">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-pink-100 text-pink-800 font-bold text-xs flex items-center justify-center">
                        {row.employee?.avatar_initials || '—'}
                      </div>
                      <div>
                        <div className="text-sm">{row.employee?.full_name || 'Unknown'}</div>
                        <div className="text-[10px] text-pink-400 font-mono">
                          {row.employee?.email || row.employee_id.slice(0, 8)}
                        </div>
                      </div>
                    </div>
                  </TD>
                  <TD className="text-pink-600">
                    <div className="font-medium text-xs text-pink-950">{row.employee?.role || 'Staff'}</div>
                    <div className="text-[11px] text-pink-500">{row.terminal}</div>
                  </TD>
                  <TD>
                    <span className="font-mono text-[11px] bg-pink-50 border border-pink-200 px-2 py-0.5 rounded text-pink-800 font-semibold">
                      {row.terminal.includes('ESP32') ? row.terminal : 'ESP32-GATE-01'}
                    </span>
                  </TD>
                  <TD className="text-emerald-800 font-mono text-xs font-bold">
                    {formatScan(row.time_in || row.last_scan)}
                  </TD>
                  <TD className="text-rose-800 font-mono text-xs font-bold">
                    {row.time_out ? formatScan(row.time_out) : <span className="text-pink-300 font-normal">--:--:--</span>}
                  </TD>
                  <TD>
                    <button
                      onClick={() => cycleStatus(row)}
                      disabled={!canManageAttendance(role)}
                      title={canManageAttendance(role) ? 'Click to cycle status' : undefined}
                      className={canManageAttendance(role) ? 'cursor-pointer' : 'cursor-default'}
                    >
                      <Badge className={ATTENDANCE_BADGE[row.status]}>{row.status}</Badge>
                    </button>
                  </TD>
                  <TD className="text-right">
                    <Button
                      variant="secondary"
                      onClick={() => startPairing(row.employee || { id: row.employee_id, full_name: 'Employee', role: 'Staff' })}
                      className="text-[11px] py-1 px-2.5 flex items-center gap-1 ml-auto bg-pink-50 hover:bg-pink-100 text-pink-800 border-pink-200"
                    >
                      <Key size={12} className="text-pink-600" />
                      <span>Pair Card</span>
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}

        {/* TAB 2: FULL ROSTER DIRECTORY (ALL 61 EMPLOYEES FROM SUPABASE) */}
        {activeTab === 'roster' && (
          <Table>
            <THead>
              <TR header>
                <TH>Employee Name</TH>
                <TH>Roster Role</TH>
                <TH>Terminal Location</TH>
                <TH>Registered Card UID</TH>
                <TH className="text-right">Card Assignment</TH>
              </TR>
            </THead>
            <TBody>
              {filteredRoster.map((emp) => (
                <TR key={emp.id}>
                  <TD className="font-bold text-pink-950">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-pink-100 text-pink-800 font-bold text-xs flex items-center justify-center">
                        {emp.avatar_initials || '👤'}
                      </div>
                      <span className="text-sm">{emp.full_name}</span>
                    </div>
                  </TD>
                  <TD className="text-xs text-pink-900 font-medium">{emp.role}</TD>
                  <TD className="text-xs text-pink-600">{emp.terminal || 'Manila Hub'}</TD>
                  <TD>
                    {emp.rfid_uid ? (
                      <span className="font-mono text-xs bg-emerald-50 border border-emerald-300 text-emerald-800 px-2 py-0.5 rounded-lg font-bold">
                        🔑 {emp.rfid_uid}
                      </span>
                    ) : (
                      <span className="text-xs text-pink-400 italic">Unassigned</span>
                    )}
                  </TD>
                  <TD className="text-right">
                    <Button
                      variant="secondary"
                      onClick={() => startPairing(emp)}
                      className="text-[11px] py-1 px-3 flex items-center gap-1.5 ml-auto bg-pink-50 hover:bg-pink-100 text-pink-800 border-pink-200"
                    >
                      <Key size={12} className="text-pink-600" />
                      <span>{emp.rfid_uid ? 'Re-assign Card' : 'Assign RFID Card'}</span>
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}

        {activeTab === 'live_scans' && filteredScans.length === 0 && (
          <p className="text-xs text-pink-400 text-center py-8">No matching attendance records found.</p>
        )}

        {activeTab === 'roster' && filteredRoster.length === 0 && (
          <p className="text-xs text-pink-400 text-center py-8">No matching roster employees found.</p>
        )}
      </Card>
    </DashboardLayout>
  );
}

function formatScan(iso: string): string {
  if (!iso) return 'N/A';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
