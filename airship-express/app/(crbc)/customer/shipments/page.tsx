import { redirect } from "next/navigation";
import Link from "next/link";
import { Package, PlusCircle } from "lucide-react";
import { getCurrentUser } from "../../library/auth/getCurrentUser";
import { getBookingRequests } from "../../services/booking-request.service";
import type { BookingRequestStatus } from "../../types/booking-request";
import { REQUEST_STATUS_LABELS } from "../../types/booking-request";
import CancelBookingButton from "../../components/customer/CancelBookingButton";

const statusStyles: Record<BookingRequestStatus, string> = {
  DRAFT:      "bg-line/60 text-muted",
  SUBMITTED:  "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  PENDING:    "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
  ACCEPTED:   "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  REJECTED:   "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  CANCELLED:  "bg-line/60 text-muted line-through",
};

export default async function ShipmentsPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const requests = await getBookingRequests({ customerUuid: currentUser.customer.id });

  return (
    <div className="py-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-bricolage text-xl font-semibold text-foreground sm:text-2xl">
            My Shipments
          </h1>
          <p className="mt-1 text-sm text-muted">
            Track and manage your shipment requests.
          </p>
        </div>
        <Link
          href="/customer/shipments/new"
          className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-dark transition-colors"
        >
          <PlusCircle size={15} />
          New Request
        </Link>
      </div>

      {requests.length === 0 ? (
        <div className="rounded-2xl border border-line bg-background p-12 text-center">
          <Package size={32} className="mx-auto mb-3 text-muted/50" />
          <p className="text-sm font-medium text-foreground">No shipments yet</p>
          <p className="mt-1 text-xs text-muted">
            Submit your first shipment request to get started.
          </p>
          <Link
            href="/customer/shipments/new"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark transition-colors"
          >
            <PlusCircle size={14} />
            Request Shipment
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-background overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-background/60 text-left text-xs text-muted">
                <th className="px-5 py-3 font-medium">Reference</th>
                <th className="px-5 py-3 font-medium">Receiver</th>
                <th className="px-5 py-3 font-medium hidden sm:table-cell">Destination</th>
                <th className="px-5 py-3 font-medium hidden md:table-cell">Date</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {requests.map((r) => (
                <tr key={r.id} className="hover:bg-background/50 transition-colors">
                  <td className="px-5 py-3.5 font-mono text-xs text-accent">
                    {r.request_id}
                  </td>
                  <td className="px-5 py-3.5 font-medium text-foreground max-w-35 truncate">
                    {r.receiver_name}
                  </td>
                  <td className="px-5 py-3.5 text-muted hidden sm:table-cell max-w-45 truncate">
                    {r.receiver_address}
                  </td>
                  <td className="px-5 py-3.5 text-muted hidden md:table-cell whitespace-nowrap">
                    {new Date(r.created_at).toLocaleDateString("en-PH", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusStyles[r.status as BookingRequestStatus]}`}>
                      {REQUEST_STATUS_LABELS[r.status as BookingRequestStatus] ?? r.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {r.status === "PENDING" && (
                      <CancelBookingButton requestId={r.request_id} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
