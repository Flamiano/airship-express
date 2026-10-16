import { redirect } from "next/navigation";
import Link from "next/link";
import { Package, PlusCircle } from "lucide-react";
import { getCurrentUser } from "../../library/auth/getCurrentUser";
import { getBookingRequests } from "../../services/booking-request.service";
import { getSLAPoliciesFromStore } from "../../services/sla-policies.store";
import { getShipmentsByCustomerId } from "../../services/shipment.service";
import {
  REQUEST_STATUS_LABELS,
  type BookingRequestStatus,
} from "../../types/booking-request";
import {
  PageHeader,
  Panel,
  EmptyState,
  PrimaryLink,
  SecondaryLink,
  StatusPill,
} from "../../components/customer/PortalUI";
import { CompletedShipmentsWithFeedback } from "../../components/customer/CompletedShipmentsWithFeedback";
import { getCustomerDeliveredShipments, getCustomerFeedback } from "../../actions/feedback";


const CHANNEL_LABELS: Record<string, string> = {
  PORTAL: "Portal",
  WALK_IN: "Walk-in",
  PHONE_CALL: "Phone",
};

/** Rejected and Cancelled are final outcomes, not work in progress. */
const TERMINAL_STATUSES = new Set(["REJECTED", "CANCELLED"]);

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function ShipmentHistoryPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/customerportalAuth/login");
  if (currentUser.profile.role !== "customer") redirect("/crbc/dashboard");

  const customer = currentUser.customer;

  // No CRM record yet is a valid state: the account exists but no booking has
  // ever been made for them, on any channel.
  if (!customer) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 py-6">
        <PageHeader
          title="Shipment History"
          description="Every parcel request on your account."
        />
        <Panel>
          <EmptyState
            icon={<Package size={16} />}
            title="No shipment history yet"
            description="Once you submit a shipment request, or visit one of our hubs, it will appear here."
            action={<PrimaryLink href="/customer/shipments/new">Create a Shipment Request</PrimaryLink>}
          />
        </Panel>
      </div>
    );
  }


  const [historyRequests, pendingRequests, slaPolicies, feedbackData, feedbackSubmitted] =
    await Promise.all([
      getBookingRequests({ customerUuid: customer.id }),
      getBookingRequests({ customerUuid: customer.id, status: "PENDING" }),
      getSLAPoliciesFromStore(),
      getCustomerDeliveredShipments(),
      getCustomerFeedback(),
    ]);

  const requests = [...historyRequests];
  const seenRequestIds = new Set(requests.map((r) => r.request_id));
  for (const pending of pendingRequests) {
    if (!seenRequestIds.has(pending.request_id)) {
      requests.push(pending);
    }
  }

  const shipments = await getShipmentsByCustomerId(
    customer.customer_id,
    slaPolicies
  );

  // COMPLETED — freight ops delivered OR booking status DELIVERED
  const freightOpsDeliveredIds = new Set(
    shipments.filter((s) => s.actual_delivery !== null).map((s) => s.request_id)
  );
  const completedRequestIds = new Set([
    ...freightOpsDeliveredIds,
    ...requests.filter((r) => r.status === "DELIVERED").map((r) => r.request_id),
  ]);

  // PROCESSING — every request not in the completed set
  const processing = requests.filter(
    (r) => !completedRequestIds.has(r.request_id)
  );
  // Newest first. The service already orders by created_at desc, but a row
  // merged in from the dedicated PENDING fetch is appended after that, so it is
  // re-sorted here to guarantee a just-submitted request sits at the top.
  const inProgress = processing
    .filter((r) => !TERMINAL_STATUSES.has(r.status))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const pastRequests = processing
    .filter((r) => TERMINAL_STATUSES.has(r.status))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));


  return (
    <div className="mx-auto max-w-4xl space-y-6 py-6">
      <PageHeader
        title="Shipment History"
        description="Every parcel request on your account, whether submitted online or recorded by our team."
        action={
          <PrimaryLink href="/customer/shipments/new">
            <PlusCircle size={14} />
            New Shipment Request
          </PrimaryLink>
        }
      />

      <p className="-mt-3 max-w-2xl text-xs leading-relaxed text-muted">
        A <span className="text-foreground">shipment request</span> is what you
        asked for — through the portal, at the counter as a walk-in, or over the
        phone. Once Airship Express accepts it and Freight Operations processes
        it, your parcel is tracked here until it is delivered.
      </p>


      {/* ── PROCESSING ─────────────────────────────────────────────── */}
      <Panel
        title={`Processing (${processing.length})`}
        description="Requests being handled, and parcels still on the move."
      >
        {processing.length === 0 ? (
          <EmptyState
            icon={<Package size={16} />}
            title="Nothing in progress"
            description={
              requests.length === 0
                ? "You have no shipment requests on your account yet."
                : "Every request on your account has reached a final outcome. New requests will appear here while they are being handled."
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-line">
              {inProgress.map((r) => {
                const status = r.status as BookingRequestStatus;
                // A shipment may already exist while the request is still open.
                const shipment = shipments.find(
                  (s) => s.request_id === r.request_id
                );

                return (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-line/20"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/customer/shipment-history/${r.request_id}`}
                          className="font-mono text-xs text-accent hover:underline"
                        >
                          {r.request_id}
                        </Link>
                        <StatusPill
                          status={REQUEST_STATUS_LABELS[status] ?? r.status}
                        />
                        {shipment && (
                          <StatusPill status={shipment.status} />
                        )}
                      </div>
                      <p className="mt-1 truncate text-xs text-muted">
                        {CHANNEL_LABELS[r.request_channel] ??
                          r.request_channel}
                        {" · "}
                        Submitted {shortDate(r.created_at)}
                        {" · "}
                        To {r.receiver.name}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {shipment ? (
                        <SecondaryLink
                          href={`/customer/shipments/${r.request_id}`}
                        >
                          View Shipment
                        </SecondaryLink>
                      ) : null}
                      <SecondaryLink
                        href={`/customer/shipment-history/${r.request_id}`}
                      >
                        View Request
                      </SecondaryLink>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Terminal outcomes kept visible, separated so they do not read
                as work still in progress. */}
            {pastRequests.length > 0 && (
              <>
                <div className="border-t border-line bg-line/20 px-5 py-2">
                  <p className="text-xs font-medium text-muted">
                    Past requests
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    Not accepted, so no shipment was created.
                  </p>
                </div>
                <ul className="divide-y divide-line">
                  {pastRequests.map((r) => {
                    const status = r.status as BookingRequestStatus;
                    return (
                      <li
                        key={r.id}
                        className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-line/20"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/customer/shipment-history/${r.request_id}`}
                              className="font-mono text-xs text-accent hover:underline"
                            >
                              {r.request_id}
                            </Link>
                            <StatusPill
                              status={REQUEST_STATUS_LABELS[status] ?? r.status}
                            />
                          </div>
                          <p className="mt-1 truncate text-xs text-muted">
                            {CHANNEL_LABELS[r.request_channel] ??
                              r.request_channel}
                            {" · "}
                            Submitted {shortDate(r.created_at)}
                          </p>
                        </div>
                        <SecondaryLink
                          href={`/customer/shipment-history/${r.request_id}`}
                        >
                          View Request
                        </SecondaryLink>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </>
        )}
      </Panel>

      {/* ── COMPLETED ──────────────────────────────────────────────── */}
      <Panel
        title={`Completed (${feedbackData.shipments.length})`}
        description="Parcels delivered — leave feedback to help us improve."
      >
        <CompletedShipmentsWithFeedback
          shipments={feedbackData.shipments}
          submittedIds={feedbackData.submittedIds}
          existingFeedback={feedbackSubmitted.feedback}
        />
      </Panel>
    </div>
  );
}
