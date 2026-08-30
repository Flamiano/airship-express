"use client";

import { useMask } from "../lib/MaskContext";
import StatusBadge from "./StatusBadge";
import TrendIcon from "./TrendIcon";

type CostEntry = {
  id: string;
  vehicleId?: string | null;
  tripId?: string | null;
  category: string;
  amount: number | null;
  entryDate?: string | null;
  created_at?: string | null;
  remarks?: string | null;
};

const columns = [
  "Date",
  "Vehicle",
  "Trip",
  "Category",
  "Amount",
  "Remarks",
];

const formatAmount = (value?: number | null) => {
  if (value == null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export default function AssetCostTable({ entries }: { entries: CostEntry[] }) {
  const { isItemVisible, toggleItem } = useMask();

  return (
    <div className="bg-white rounded-md border border-pink-100 col-span-1 lg:col-span-3 overflow-hidden flex flex-col shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-pink-50 text-primary font-label-md text-label-sm uppercase border-b border-pink-100">
            <tr>
              {columns.map((col, i) => (
                <th
                  key={col}
                  className={`p-4 whitespace-nowrap ${i === 4 ? "text-right" : ""} ${i === 5 ? "text-left" : ""}`}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-body-md divide-y divide-surface-variant">
            {entries.length === 0 ? (
              <tr>
                <td className="p-6 text-center text-secondary" colSpan={columns.length}>
                  No cost entries are available yet.
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-surface-container-low transition-colors">
                  <td className="p-4 whitespace-nowrap text-secondary">
                    {entry.entryDate ?? entry.created_at ?? "—"}
                  </td>
                  <td className="p-4 text-secondary">{entry.vehicleId ?? "—"}</td>
                  <td className="p-4 text-secondary">{entry.tripId ?? "—"}</td>
                  <td className="p-4 text-secondary">{entry.category}</td>
                  <td
                    className="p-4 text-right font-semibold text-on-surface cursor-pointer"
                    onClick={() => toggleItem(entry.id)}
                    title={isItemVisible(entry.id) ? "Hide amount" : "Show amount"}
                  >
                    {isItemVisible(entry.id) ? formatAmount(entry.amount) : "*******"}
                  </td>
                  <td className="p-4 text-secondary">{entry.remarks ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
