'use client';

import React, { useState, useEffect } from 'react';
import { Clock, Radio, Key, CheckCircle, AlertCircle, RefreshCw, LogIn, LogOut, ArrowRightCircle } from 'lucide-react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Table, THead, TBody, TR, TH, TD } from '../../components/ui/Table';
import { useRealtimeAttendance } from '../../hooks/useRealtime';
import { useAuth } from '../../hooks/useAuth';
import { ATTENDANCE_BADGE } from '../../utils/constants';
import { canManageAttendance } from '../../utils/rbac';
import { apiFetch } from '../../lib/apiFetch';
import type { AttendanceLog, AttendanceStatus, Employee } from '../../types/workforce';

const FASTAPI_URL = 'http://localhost:8000';

export default function AttendancePage() {
  const { attendance, connected, refetch } = useRealtimeAttendance();
  const { role } = useAuth();
  const [filter, setFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'live_scans' | 'roster'>('live_scans');
  const [profiles, setProfiles] = useState<Employee[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);

  const [pairingModalOpen, setPairingModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [isWaitingForCard, setIsWaitingForCard] = useState(false);
  const [pairingStatusMsg, setPairingStatusMsg] = useState<string | null>(null);
  const [pairedSuccessUid, setPairedSuccessUid] = useState<string | null>(null);
  const [hwOnline, setHwOnline] = useState(true);

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

  useEffect(() => {
    if (!isWaitingForCard || !selectedEmployee) return;
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`${FASTAPI_URL}/api/v1/registration/status`);
        if (res.ok) {
          const data = await res.json();
          if (!data.is_active && data.captured_uid) {
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

  const handleUnbind = async (employeeId: string) => {
    if (!confirm('Are you sure you want to unbind the RFID card from this employee?')) return;
    try {
      const res = await fetch(`/workforce-management-dashboard/api/profiles?employee_id=${encodeURIComponent(employeeId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await loadProfiles();
        refetch();
      }
    } catch (err) {
      console.error('Failed to unbind RFID card:', err);
    }
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

  const filteredScans = attendance.filter((a) =>
    (a.employee?.full_name ?? '').toLowerCase().includes(filter.toLowerCase()) ||
    (a.employee?.role ?? '').toLowerCase().includes(filter.toLowerCase())
  );

  const filteredRoster = profiles.filter((p) =>
    (p.full_name ?? '').toLowerCase().includes(filter.toLowerCase()) ||
    (p.role ?? '').toLowerCase().includes(filter.toLowerCase()) ||
    (p.email ?? '').toLowerCase().includes(filter.toLowerCase())
  );

  const onShiftCount = attendance.filter((a) => a.status === 'On-Shift').length;
  const onBreakCount = attendance.filter((a) => a.status === 'On-Break').length;
  const tardyCount = attendance.filter((a) => a.status === 'Tardy').length;

  return (
    <DashboardLayout realtimeConnected={connected}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-paper p-5 rounded-2xl border border-line shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-ink">Time & Attendance System</h1>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${hwOnline ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'}`}>
              <Radio size={13} className={hwOnline ? 'animate-pulse text-emerald-500' : ''} />
              {hwOnline ? 'ESP32 Node 01 Online' : 'ESP32 Gateway Offline'}
            </span>
          </div>
          <p className="text-xs text-muted mt-1">Real-time biometric & RFID terminal scanner logs synced to Supabase database.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => { refetch(); loadProfiles(); }} variant="secondary" className="flex items-center gap-1.5 text-xs py-2 px-3">
            <RefreshCw size={14} /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-paper border border-line p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">On-Shift Active</p>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          </div>
          <p className="text-2xl font-bold text-ink mt-1">{onShiftCount}</p>
        </div>
        <div className="bg-paper border border-line p-4 rounded-2xl shadow-sm">
          <p className="text-xs font-semibold text-accent uppercase tracking-wider">On Break</p>
          <p className="text-2xl font-bold text-ink mt-1">{onBreakCount}</p>
        </div>
        <div className="bg-paper border border-line p-4 rounded-2xl shadow-sm">
          <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Tardy / Late</p>
          <p className="text-2xl font-bold text-rose-500 mt-1">{tardyCount}</p>
        </div>
        <div className="bg-paper border border-line p-4 rounded-2xl shadow-sm">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total Roster</p>
          <p className="text-2xl font-bold text-ink mt-1">{profiles.length}</p>
        </div>
      </div>

      {pairingModalOpen && selectedEmployee && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-paper text-ink rounded-3xl border border-line shadow-2xl max-w-md w-full p-6 space-y-4 animate-modal">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2 text-ink font-semibold text-base">
                <Key className="text-accent" size={20} />
                <h3>Assign RFID Card</h3>
              </div>
              <button onClick={cancelPairing} className="text-muted hover:text-ink text-sm font-bold">✕</button>
            </div>
            <div className="text-center py-4 space-y-3">
              <div className="w-16 h-16 rounded-full bg-accent/15 text-accent font-bold text-xl flex items-center justify-center mx-auto shadow-inner">
                {selectedEmployee.avatar_initials || '👤'}
              </div>
              <div>
                <h4 className="font-semibold text-ink text-base">{selectedEmployee.full_name}</h4>
                <p className="text-xs text-muted">{selectedEmployee.role} • {selectedEmployee.terminal || 'Manila Hub'}</p>
              </div>
              {isWaitingForCard ? (
                <div className="bg-accent/5 border-2 border-dashed border-accent/30 rounded-2xl p-5 space-y-2 animate-pulse">
                  <div className="text-2xl">📲</div>
                  <p className="font-bold text-ink text-sm">TAP RFID CARD ON ESP32 READER</p>
                  <p className="text-xs text-muted">The hardware antenna will instantly capture and assign the tag UID to this employee.</p>
                </div>
              ) : pairedSuccessUid ? (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 space-y-1">
                  <div className="flex items-center justify-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                    <CheckCircle size={18} /> Card Linked Successfully!
                  </div>
                  <p className="font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold">UID: {pairedSuccessUid}</p>
                </div>
              ) : null}
              {pairingStatusMsg && <p className="text-xs text-muted font-medium">{pairingStatusMsg}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-line pt-3">
              <Button variant="secondary" onClick={cancelPairing} className="text-xs">{pairedSuccessUid ? 'Done' : 'Cancel'}</Button>
            </div>
          </div>
        </div>
      )}

      <Card className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('live_scans')}
              className={`text-xs sm:text-sm font-semibold px-3.5 py-1.5 rounded-xl transition-all ${
                activeTab === 'live_scans'
                  ? 'bg-accent text-paper shadow-sm shadow-accent/25'
                  : 'text-muted hover:text-ink hover:bg-ink/[0.04] dark:hover:bg-paper/[0.06]'
              }`}
            >
              ⏱️ Attendance logs ({filteredScans.length})
            </button>
            <button
              onClick={() => setActiveTab('roster')}
              className={`text-xs sm:text-sm font-semibold px-3.5 py-1.5 rounded-xl transition-all ${
                activeTab === 'roster'
                  ? 'bg-accent text-paper shadow-sm shadow-accent/25'
                  : 'text-muted hover:text-ink hover:bg-ink/[0.04] dark:hover:bg-paper/[0.06]'
              }`}
            >
              👥 Employee and ID-setup ({filteredRoster.length})
            </button>
          </div>
          <input
            type="text"
            placeholder="Search employee, role, or ID..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="text-xs bg-ink/[0.03] dark:bg-paper/[0.05] border border-line rounded-xl px-3 py-1.5 text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 w-full sm:w-64 transition-all"
          />
        </div>

        {activeTab === 'live_scans' && (
          <Table>
            <THead>
              <TR header>
                <TH>Employee</TH><TH>Role & Terminal</TH><TH>Device Station</TH><TH>Time In</TH><TH>Time Out</TH><TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {filteredScans.map((row) => (
                <TR key={row.id}>
                  <TD className="font-semibold text-ink">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-accent/15 text-accent font-bold text-xs flex items-center justify-center">
                        {row.employee?.avatar_initials || '—'}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-ink">{row.employee?.full_name || 'Unknown'}</div>
                        <div className="text-[10px] text-muted font-mono">{row.employee?.email || row.employee_id.slice(0, 8)}</div>
                      </div>
                    </div>
                  </TD>
                  <TD>
                    <div className="font-medium text-xs text-ink">{row.employee?.role || 'Staff'}</div>
                    <div className="text-[11px] text-muted">{row.terminal}</div>
                  </TD>
                  <TD>
                    <span className="font-mono text-[11px] bg-ink/[0.04] dark:bg-paper/[0.06] border border-line px-2 py-0.5 rounded text-ink font-medium">
                      {row.terminal.includes('ESP32') ? row.terminal : 'ESP32-GATE-01'}
                    </span>
                  </TD>
                  <TD className="text-emerald-600 dark:text-emerald-400 font-mono text-xs font-semibold">{formatScan(row.time_in || row.last_scan)}</TD>
                  <TD className="text-rose-600 dark:text-rose-400 font-mono text-xs font-semibold">{row.time_out ? formatScan(row.time_out) : <span className="text-muted font-normal">--:--:--</span>}</TD>
                  <TD>
                    <button onClick={() => cycleStatus(row)} disabled={!canManageAttendance(role)} title={canManageAttendance(role) ? 'Click to cycle status' : undefined} className={canManageAttendance(role) ? 'cursor-pointer' : 'cursor-default'}>
                      <Badge className={ATTENDANCE_BADGE[row.status]}>{row.status}</Badge>
                    </button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}

        {activeTab === 'roster' && (
          <Table>
            <THead>
              <TR header>
                <TH>Employee Name</TH><TH>Role</TH><TH>Terminal Location</TH><TH>Registered Card UID</TH><TH className="text-right">Card Assignment</TH>
              </TR>
            </THead>
            <TBody>
              {filteredRoster.map((emp) => (
                <TR key={emp.id}>
                  <TD className="font-semibold text-ink">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-accent/15 text-accent font-bold text-xs flex items-center justify-center">
                        {emp.avatar_initials || '👤'}
                      </div>
                      <span className="text-sm">{emp.full_name}</span>
                    </div>
                  </TD>
                  <TD className="text-xs text-muted font-medium">{emp.role}</TD>
                  <TD className="text-xs text-muted">{emp.terminal || 'Manila Hub'}</TD>
                  <TD>
                    {emp.rfid_uid ? (
                      <span className="font-mono text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-lg font-bold">
                        🔑 {emp.rfid_uid}
                      </span>
                    ) : (
                      <span className="text-xs text-muted italic">Unassigned</span>
                    )}
                  </TD>
                  <TD className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button variant="secondary" onClick={() => startPairing(emp)} className="text-xs py-1 px-3 flex items-center gap-1">
                        <Key size={12} className="text-accent" /><span>{emp.rfid_uid ? 'Re-assign' : 'Assign RFID'}</span>
                      </Button>
                      {emp.rfid_uid && (
                        <Button variant="danger" onClick={() => handleUnbind(emp.id)} className="text-xs py-1 px-2.5">
                          Unbind
                        </Button>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}

        {activeTab === 'live_scans' && filteredScans.length === 0 && (
          <p className="text-xs text-muted text-center py-8">No matching attendance records found.</p>
        )}
        {activeTab === 'roster' && filteredRoster.length === 0 && (
          <p className="text-xs text-muted text-center py-8">No matching roster employees found.</p>
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
