"use client";

import { useMemo, useState } from "react";
import { Search, Eye } from "lucide-react";
import Link from "next/link";
import type { ComplianceRecord, ComplianceStatus } from "../types/compliance.requirement";
import { formatDate } from "../library/utils/formattedate";
import type { Customers } from "../types/customer";
import IconBtn from "./IconBtn";

const complianceStatusStyle: Record<ComplianceStatus, string> = {
  Compliant: "bg-emerald-50 text-emerald-600",
  Pending: "bg-amber-50 text-amber-600",
  "Non-Compliant": "bg-red-50 text-red-600",
};

export default function ComplianceManagement({
  initialRecords,
  initialCustomers,
}: {
  initialRecords: ComplianceRecord[];
  initialCustomers: Customers[];
}) {
  const records = initialRecords;
  const customers = initialCustomers;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [customerFilter, setCustomerFilter] = useState("All");

  const customerMap = useMemo(
    () =>
      Object.fromEntries(
        customers.map((customer) => [
          customer.customer_id,
          customer.full_name,
        ])
      ),
    [customers]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return records.filter((record) => {
      const matchSearch =
        !q ||
        record.compliance_id.toLowerCase().includes(q) ||
        record.shipment_id.toLowerCase().includes(q) ||
        record.customer_id.toLowerCase().includes(q);

      const matchStatus =
        statusFilter === "All" ||
        record.status === statusFilter;

      const matchCustomer =
        customerFilter === "All" ||
        record.customer_id === customerFilter;

      return matchSearch && matchStatus && matchCustomer;
    });
  }, [records, search, statusFilter, customerFilter]);

  return (
    <div className="w-full py-4 space-y-4 text-foreground">

      {/* Header */}
      <div>
        <h1 className="text-ink text-xl font-semibold">
          Compliance Manager
        </h1>

        <p className="text-muted text-sm mt-0.5">
          Monitor shipment compliance and review compliance records
        </p>
      </div>

      {/* Filters */}
      <div className="bg-backrground border border-line rounded-xl p-3 flex flex-wrap items-center gap-3">

        {/* Search */}
        <div className="relative flex-1 min-w-52">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2"
          />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Compliance ID or Shipment ID..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-line text-sm text-zinc-700 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
          />
        </div>

        {/* Status */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-line text-xs focus:outline-none focus:ring-2 focus:ring-indigo-100"
        >
          {[
            "All",
            "Compliant",
            "Pending",
            "Non-Compliant",
          ].map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

        {/* Customer */}
        <select
          value={customerFilter}
          onChange={(e) => setCustomerFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-line text-xs focus:outline-none focus:ring-2 focus:ring-indigo-100"
        >
          <option value="All">All Customers</option>

          {customers.map((customer) => (
            <option
              key={customer.customer_id}
              value={customer.customer_id}
            >
              {customer.full_name}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-backrground border border-line rounded-xl overflow-hidden">

        <table className="w-full text-sm">

          <thead>
            <tr className="border-b border-line text-left">
              {[
                "Compliance ID",
                "Shipment ID",
                "Customer",
                "Status",
                "Date",
                "Actions",
              ].map((heading) => (
                <th
                  key={heading}
                  className="px-4 py-3 font-medium text-xs text-foreground uppercase tracking-wide whitespace-nowrap"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm"
                >
                  No compliance records found.
                </td>
              </tr>
            )}

            {filtered.map((record) => (
              <tr
                key={record.compliance_id}
                className="border-b border-line last:border-0 hover:bg-zinc-50/60 transition-colors"
              >
                {/* Compliance ID */}
                <td className="px-4 py-3 font-medium text-accent text-xs">
                  {record.compliance_id}
                </td>

                {/* Shipment ID */}
                <td className="px-4 py-3 text-xs">
                  {record.shipment_id}
                </td>

                {/* Customer */}
                <td className="px-4 py-3 text-xs">
                  {customerMap[record.customer_id] ??
                    record.customer_id}
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      complianceStatusStyle[record.status]
                    }`}
                  >
                    {record.status}
                  </span>
                </td>

                {/* Reviewed */}
                <td className="px-4 py-3text-xs">
                  {record.reviewed_at
                    ? formatDate(record.reviewed_at)
                    : "—"}
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                  <Link
                        href={`/crbc/compliance/${record.compliance_id}`}
                        >
                        <IconBtn
                            icon={Eye}
                            title="View Compliance"
                        />
                        </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>

        </table>
      </div>
    </div>
  );
}