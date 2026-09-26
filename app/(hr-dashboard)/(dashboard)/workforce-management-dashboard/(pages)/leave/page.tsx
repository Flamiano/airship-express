'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/apiFetch';
import { ExportPrintDropdown } from '../../components/ui/ExportPrintDropdown';
import { Table, THead, TBody, TR, TH, TD } from '../../components/ui/Table';
import { LeaveRequestReviewModal } from '../../components/modals/LeaveRequestReviewModal';
import { LeaveRequestModal } from '../../components/modals/LeaveRequestModal';
import { Button } from '../../components/ui/Button';
import { Search, Inbox, Plus } from 'lucide-react';

export default function LeavePage() {
  const [filter, setFilter] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [bals, reqs] = await Promise.all([
          apiFetch<any[]>('/api/leave/balances').catch(() => []),
          apiFetch<any[]>('/api/leave/requests').catch(() => []),
        ]);
        setEmployees(bals || []);
        setPendingRequests(reqs || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredEmployees = employees.filter(e => e.name?.toLowerCase().includes(filter.toLowerCase()));

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-paper p-5 rounded-2xl border border-line shadow-sm mb-6">
        <div>
          <h1 className="text-xl font-bold text-ink">Leave & Fatigue Rest Management</h1>
          <p className="text-xs text-muted mt-1">
            Track employee leave balances and review pending requests.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportPrintDropdown />
          <Button onClick={() => setCreateModalOpen(true)} variant="primary">
            <Plus size={16} />
            File Leave Request
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Pending Requests Queue */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
            <Inbox size={16} className="text-accent" />
            Action Required ({pendingRequests.length})
          </h2>
          <div className="space-y-3">
            {pendingRequests.map(req => (
              <div
                key={req.id}
                onClick={() => setSelectedRequest(req)}
                className="bg-paper p-4 rounded-xl border border-line shadow-2xs hover:border-accent/50 cursor-pointer transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-sm font-semibold text-ink">{req.name}</h3>
                  <span className="text-[10px] font-medium bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full">Pending</span>
                </div>
                <p className="text-xs text-muted mb-1">{req.role}</p>
                <p className="text-xs text-ink font-medium">{req.type} • {req.duration}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right Col: Employee Balances */}
        <div className="lg:col-span-2">
          <div className="bg-paper p-5 rounded-2xl border border-line shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
              <h2 className="text-sm font-semibold text-ink">Employee Leave Balances</h2>
              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="text-xs bg-ink/[0.03] dark:bg-paper/[0.05] border border-line rounded-xl pl-9 pr-3 py-2 text-ink placeholder:text-muted focus:outline-none focus:border-accent w-full transition-all"
                />
              </div>
            </div>

            <Table>
              <THead>
                <TR header>
                  <TH>Employee</TH><TH>Role</TH><TH>Sick Leave</TH><TH>Vacation Leave</TH>
                </TR>
              </THead>
              <TBody>
                {filteredEmployees.map((emp) => (
                  <TR key={emp.id}>
                    <TD className="font-semibold text-ink">{emp.name}</TD>
                    <TD className="text-muted">{emp.role}</TD>
                    <TD>
                      <span className={`text-xs font-medium ${emp.sickBalance < 3 ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {emp.sickBalance} days
                      </span>
                    </TD>
                    <TD>
                      <span className={`text-xs font-medium ${emp.vacationBalance < 3 ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {emp.vacationBalance} days
                      </span>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </div>
      </div>

      <LeaveRequestReviewModal
        isOpen={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        request={selectedRequest}
      />

      <LeaveRequestModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={async (payload) => {
          console.log('Submitted leave:', payload);
          // Prototype mode: Just log and close
          return new Promise((resolve) => setTimeout(resolve, 500));
        }}
      />
    </>
  );
}

