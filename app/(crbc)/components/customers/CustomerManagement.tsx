"use client";

import React, { useMemo, useState, useCallback } from "react";
import {
  Search,
  Plus,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import Link from "next/link";

import type { Customers } from "../../types/customer";
import { formatPhoneNumber } from "../../library/utils/formatPhoneNumber";
import IconBtn from "../ui/IconBtn";
import NewBookingRequestWizard from "./NewBookingRequestWizard";

const PAGE_SIZE = 10;

export default function CustomerManagement({
  initialCustomers,
}: {
  initialCustomers: Customers[];
}) {
  const customers = initialCustomers;

  const [query, setQuery] = useState("");
  const [searchBy, setSearchBy] = useState<"all" | "customer_id" | "phone" | "name">("all");
  const [page, setPage] = useState(1);
  const [wizardOpen, setWizardOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return customers.filter((customer) => {
      let matchesQuery = !q;

      if (q) {
        switch (searchBy) {
          case "customer_id":
            matchesQuery = customer.customer_id.toLowerCase().includes(q);
            break;
          case "phone":
            matchesQuery = (formatPhoneNumber(customer.phone || null) ?? "").toLowerCase().includes(q);
            break;
          case "name":
            matchesQuery = customer.full_name.toLowerCase().includes(q);
            break;
          default:
            matchesQuery =
              customer.full_name.toLowerCase().includes(q) ||
              customer.customer_id.toLowerCase().includes(q) ||
              (customer.email?.toLowerCase().includes(q) ?? false) ||
              (formatPhoneNumber(customer.phone || null) ?? "").toLowerCase().includes(q);
        }
      }

      return matchesQuery;
    });
  }, [customers, query, searchBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const pageRows = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleSearch = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(event.target.value);
      setPage(1);
    },
    []
  );

  const handleSearchByChange = useCallback((value: string) => {
    setSearchBy(value as "all" | "customer_id" | "phone" | "name");
    setPage(1);
  }, []);

  const handleClearSearch = useCallback(() => {
    setQuery("");
    setSearchBy("all");
    setPage(1);
  }, []);

  const hasActiveFilters = !!query;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Customer Management
          </h1>

          <p className="text-sm text-muted mt-1">
            {filtered.length} total customers in the system
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/80 hover:bg-accent-dark/80 text-white text-sm transition-colors cursor-pointer"
          >
            <Plus size={15} />
            Add Customer
          </button>
        </div>
      </div>

      <NewBookingRequestWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
      />

      {/* Search & Filter Bar */}
      <div className="bg-paper border border-line rounded-xl p-4 space-y-3">
        {/* Search Input with Search By Selector */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 min-w-60">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/60"
            />
            <input
              value={query}
              onChange={handleSearch}
              placeholder={
                searchBy === "customer_id"
                  ? "Search by Customer ID (e.g., WIC-0001)..."
                  : searchBy === "phone"
                  ? "Search by phone number..."
                  : searchBy === "name"
                  ? "Search by name..."
                  : "Search by name, ID, or email..."
              }
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-line bg-background text-sm text-foreground placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-accent/15 focus:border-accent"
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="search-by" className="text-xs font-medium text-muted hidden sm:block">
              Search by:
            </label>
            <select
              id="search-by"
              value={searchBy}
              onChange={(e) => handleSearchByChange(e.target.value)}
              className="px-3 py-2 rounded-lg border border-line bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/15 focus:border-accent"
            >
              <option value="all">All Fields</option>
              <option value="customer_id">Customer ID</option>
              <option value="name">Name</option>
              <option value="phone">Phone</option>
            </select>
          </div>
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {query && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium">
                {searchBy === "customer_id" ? "ID: " : searchBy === "name" ? "Name: " : searchBy === "phone" ? "Phone: " : ""}
                {query}
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="ml-1 hover:text-accent/70"
                >
                  <X size={10} />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSearchBy("all");
                setPage(1);
              }}
              className="text-xs text-muted hover:text-foreground underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Customer Table */}
      <div className="bg-paper border border-line rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              {[
                "Customer ID",
                "Full Name",
                "Email",
                "Phone",
                "Role",
                "Actions",
              ].map((heading) => (
                <th
                  key={heading}
                  className="px-4 py-3 font-medium text-xs uppercase tracking-wide"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {pageRows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-muted text-sm"
                >
                  No customers match your filters.
                </td>
              </tr>
            )}

            {pageRows.map((customer) => (
              <tr
                key={customer.id}
                className="border-b border-line/60 last:border-0 hover:bg-accent/5 transition-colors"
              >
                <td className="px-4 py-3 font-medium text-accent">
                  {customer.customer_id}
                </td>

                <td className="px-4 py-3 font-medium text-foreground">
                  {customer.full_name}
                </td>

                <td className="px-4 py-3 text-foreground">
                  {customer.email ?? "-"}
                </td>

                <td className="px-4 py-3 text-foreground">
                  {formatPhoneNumber(customer.phone || '-')}
                </td>

                <td className="px-4 py-3 capitalize text-foreground">
                  {customer.role}
                </td>

                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    <Link
                      href={`/crbc/customers/${customer.customer_id}`}
                    >
                      <IconBtn icon={Eye} title="Customer Profile" />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-line">
          <span className="text-xs text-muted">
            Showing{" "}
            {filtered.length === 0
              ? 0
              : (currentPage - 1) * PAGE_SIZE + 1}
            –
            {Math.min(currentPage * PAGE_SIZE, filtered.length)}{" "}
            of {filtered.length} records
          </span>

          <div className="flex items-center gap-1">
            {/* Previous */}
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-md border border-line text-muted hover:text-foreground disabled:opacity-40 disabled:hover:text-muted transition-colors"
            >
              <ChevronLeft size={14} />
            </button>

            {/* Page numbers */}
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(
              (number) => (
                <button
                  type="button"
                  key={number}
                  onClick={() => setPage(number)}
                  className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${
                    number === currentPage
                      ? "bg-accent/80 text-white"
                      : "text-muted hover:bg-accent/10"
                  }`}
                >
                  {number}
                </button>
              )
            )}

            {/* Next */}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-md border border-line text-muted hover:text-foreground disabled:opacity-40 disabled:hover:text-muted transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
