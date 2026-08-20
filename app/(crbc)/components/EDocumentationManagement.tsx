"use client";

import { useMemo, useState } from "react";
import { Search, Eye, Download, Printer } from "lucide-react";
import { formatDate } from "../library/utils/formattedate";
import type { Document, PODStatus } from "../types/document";
import type { Customers } from "../types/customer";
import IconBtn from "./IconBtn";

const podStatusStyle: Record<PODStatus, string> = {
  Generated: "bg-zinc-100 text-foreground",
  "Pending Review": "bg-amber-50 text-amber-600",
  Approved: "bg-blue-50 text-blue-600",
  Released: "bg-emerald-50 text-emerald-600",
};

type EDocumentationManagementProps = {
  initialDocuments: Document[];
  initialCustomers: Customers[];
};

export default function EDocumentationManagement({
  initialDocuments,
  initialCustomers,
}: EDocumentationManagementProps) {
  const documents = initialDocuments;
  const customers = initialCustomers;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [customerFilter, setCustomerFilter] = useState("All");


  const customerMap = useMemo(() => {
    return Object.fromEntries(
      customers.map((customer) => [
        customer.customer_id,
        customer.full_name,
      ])
    );
  }, [customers]);


  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return documents.filter((document) => {
      const matchSearch =
        !q ||
        document.shipmentId.toLowerCase().includes(q) ||
        document.documentId.toLowerCase().includes(q);

      const matchStatus =
        statusFilter === "All" ||
        document.podStatus === statusFilter;

      const matchCustomer =
        customerFilter === "All" ||
        document.customerId === customerFilter;

      return matchSearch && matchStatus && matchCustomer;
    });
  }, [
    documents,
    search,
    statusFilter,
    customerFilter,
  ]);


  return (
    <div className="w-full py-4 space-y-4 text-foreground">

      {/* Header */}
      <div>
        <h1 className="text-ink text-xl font-semibold">
          E-Documentation
        </h1>

        <p className="text-muted text-sm mt-0.5">
          View, download, and print shipment POD documents
        </p>
      </div>

      {/* Filters */}
      <div className="bg-background border border-line rounded-xl p-3 flex flex-wrap items-center gap-3">

        {/* Search */}
        <div className="relative flex-1 min-w-52">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-300"
          />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Document ID or Shipment ID..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-line text-sm text-foreground placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-line text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-100"
        >
          {[
            "All",
            "Generated",
            "Pending Review",
            "Approved",
            "Released",
          ].map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

        {/* Customer Filter */}
        <select
          value={customerFilter}
          onChange={(e) => setCustomerFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-line text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-100"
        >
          <option value="All">
            All Customers
          </option>

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
      <div className="bg-background border border-line rounded-xl overflow-hidden">

        <table className="w-full text-sm">

          <thead>
            <tr className="border-b border-line text-left">

              {[
                "Document ID",
                "Shipment ID",
                "Customer",
                "Type",
                "POD Status",
                "Generated",
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

            {/* Empty state */}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center  text-sm"
                >
                  No documents found.
                </td>
              </tr>
            )}

            {/* Documents */}
            {filtered.map((document) => (
              <tr
                key={document.documentId}
                className="border-b border-line last:border-0 hover:bg-zinc-50/60 transition-colors"
              >

                {/* Document ID */}
                <td className="px-4 py-3 font-medium text-accent text-xs">
                  {document.documentId}
                </td>

                {/* Shipment ID */}
                <td className="px-4 py-3 text-foreground text-xs">
                  {document.shipmentId}
                </td>

                {/* Customer */}
                <td className="px-4 py-3 text-foreground text-xs">
                  {customerMap[document.customerId] ??
                    document.customerId}
                </td>

                {/* Document Type */}
                <td className="px-4 py-3 text-foreground text-xs">
                  {document.documentType}
                </td>

                {/* POD Status */}
                <td className="px-4 py-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      podStatusStyle[document.podStatus]
                    }`}
                  >
                    {document.podStatus}
                  </span>
                </td>

                {/* Generated Date */}
                <td className="px-4 py-3  text-xs">
                  {formatDate(document.generatedDate)}
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">

                    <IconBtn
                      icon={Eye}
                      title="View POD"
                    />

                    <IconBtn
                      icon={Download}
                      title="Download"
                    />

                    <IconBtn
                      icon={Printer}
                      title="Print"
                    />

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