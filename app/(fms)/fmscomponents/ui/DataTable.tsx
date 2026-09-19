"use client";

import React from "react";
import { EmptyState } from "./EmptyState";
import { LoadingState } from "./LoadingState";

export interface ColumnDef<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  className?: string;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  getRowId?: (row: T) => string | number;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  isLoading,
  emptyMessage = "No data available.",
  onRowClick,
  getRowId,
  className = "",
}: DataTableProps<T>) {
  if (isLoading) {
    return <LoadingState className="py-12" />;
  }

  if (!data || data.length === 0) {
    return <EmptyState title={emptyMessage} className="my-6" />;
  }

  return (
    <div
      className={`financial-datatable-scroll w-full max-w-full overflow-x-auto rounded-xl border border-border bg-card shadow-sm ${className}`}
    >
      <table className="w-full text-sm text-left whitespace-nowrap">
        <thead className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold bg-muted/40 border-b border-border">
          <tr>
            {columns.map((col, index) => (
              <th
                key={index}
                className={`px-6 py-4 ${col.className || ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-border/60">
          {data.map((row, rowIndex) => {
            let rowKey: string | number = rowIndex;

            if (getRowId) {
              rowKey = getRowId(row);
            } else if (
              typeof row === "object" &&
              row !== null &&
              "id" in row &&
              (typeof row.id === "string" || typeof row.id === "number")
            ) {
              rowKey = row.id;
            }

            return (
              <tr
                key={rowKey}
                onClick={() => onRowClick?.(row)}
                className={`group bg-card hover:bg-muted/40 transition-colors duration-150 ${
                  onRowClick ? "cursor-pointer" : ""
                }`}
              >
                {columns.map((col, colIndex) => (
                  <td
                    key={colIndex}
                    className={`px-6 py-4 text-foreground ${
                      col.className || ""
                    }`}
                  >
                    {typeof col.accessor === "function"
                      ? col.accessor(row)
                      : (row[col.accessor] as React.ReactNode)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Thin, theme-matched scrollbar instead of the browser default — scoped to
          this component only via styled-jsx, doesn't leak to other scrollable areas. */}
      <style jsx>{`
        .financial-datatable-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(229, 22, 126, 0.35) transparent;
        }
        .financial-datatable-scroll::-webkit-scrollbar {
          height: 8px;
        }
        .financial-datatable-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .financial-datatable-scroll::-webkit-scrollbar-thumb {
          background-color: rgba(229, 22, 126, 0.35);
          border-radius: 9999px;
        }
        .financial-datatable-scroll::-webkit-scrollbar-thumb:hover {
          background-color: rgba(229, 22, 126, 0.55);
        }
      `}</style>
    </div>
  );
}