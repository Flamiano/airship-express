import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Package,
  FileText,
  Truck,
  PlusCircle,
  Bell,
  ArrowRight,
  Clock,
  CheckCircle2,
  UserCircle,
} from "lucide-react";
import { getCurrentUser } from "../../library/auth/getCurrentUser";
import { getBookingRequests } from "../../services/booking-request.service";
import { getSLAPoliciesFromStore } from "../../services/sla-policies.store";
import { getShipmentsByCustomerId } from "../../services/shipment.service";
import { getDocumentsByCustomerId } from "../../services/document.service";
import { getCustomerNotifications } from "../../services/notification.service";
import {
  REQUEST_STATUS_LABELS,
  type BookingRequestStatus,
} from "../../types/booking-request";
import {
  Panel,
  EmptyState,
  PrimaryLink,
  SecondaryLink,
  StatusPill,
} from "../../components/customer/PortalUI";

export default async function CustomerDashboard() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/customerportalAuth/login");
  if (currentUser.profile.role !== "customer") redirect("/crbc/dashboard");

  const customer = currentUser.customer;

  if (!customer) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 py-6">
        <div>
          <h1 className="font-bricolage text-xl font-semibold text-foreground sm:text-2xl">
            Welcome,{" "}
            {currentUser.profile.full_name ?? currentUser.profile.email}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Your Airship Express customer account.
          </p>
        </div>
        <Panel>
          <EmptyState
            icon={<Package size={16} />}
            title="No requests yet"
            description="Submit a Shipment Request to send a parcel, or visit one of our hubs and our team will record it for you."
            action={
              <PrimaryLink href="/customer/shipments/new">
                <PlusCircle size={14} />
                Create a Shipment Request
              </PrimaryLink>
            }
          />
        </Panel>
      </div>
    );
  }

  const [requests, slaPolicies] = await Promise.all([
    getBookingRequests({ customerUuid: customer.id }),
    getSLAPoliciesFromStore(),
  ]);

  const [shipments, documents, notifications] = await Promise.all([
    getShipmentsByCustomerId(customer.customer_id, slaPolicies),
    getDocumentsByCustomerId(customer.customer_id),
    getCustomerNotifications(customer.id, requests),
  ]);

  const activeRequests = requests.filter(
    (r) => r.status === "PENDING" || r.status === "ACCEPTED" || r.status === "SUBMITTED"
  );
  const inTransit = shipments.filter(
    (s) => s.status === "In Transit" || s.status === "Batched" || s.status === "Handed Over"
  );
  const delivered = shipments.filter((s) => s.actual_delivery !== null);

  const stats = [
    {
      label: "Active Requests",
      value: activeRequests.length,
      icon: Package,
      iconColor: "text-blue-500",
      iconBg: "bg-blue-50 dark:bg-blue-950/40",
    },
    {
      label: "In Transit",
      value: inTransit.length,
      icon: Truck,
      iconColor: "text-amber-500",
      iconBg: "bg-amber-50 dark:bg-amber-950/40",
    },
    {
      label: "Delivered",
      value: delivered.length,
      icon: CheckCircle2,
      iconColor: "text-emerald-500",
      iconBg: "bg-emerald-50 dark:bg-emerald-950/40",
    },
    {
      label: "Documents",
      value: documents.length,
      icon: FileText,
      iconColor: "text-foreground/50",
      iconBg: "bg-foreground/5",
    },
  ];

  const hasActivity = stats.some((s) => s.value > 0);

  const recentRequests = requests.slice(0, 5);
  const recentNotifications = notifications.slice(0, 5);

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-bricolage text-xl font-semibold text-foreground sm:text-2xl">
            Welcome, {customer.full_name ?? currentUser.profile.full_name}
          </h1>
          <p className="mt-1 text-sm text-muted">{customer.customer_id}</p>
        </div>
        <PrimaryLink href="/customer/shipments/new">
          <PlusCircle size={14} />
          Create a Shipment Request
        </PrimaryLink>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, iconColor, iconBg }) => (
          <div
            key={label}
            className="rounded-lg border border-line bg-background px-4 py-3 flex items-center gap-3"
          >
            <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
              <Icon size={15} className={iconColor} />
            </div>
            <div>
              <p className="text-xs text-muted">{label}</p>
              <p className="text-xl font-semibold text-foreground">{value}</p>
            </div>
          </div>
        ))}
      </div>
      {!hasActivity && (
        <p className="text-xs text-muted">
          No activity yet — create your first shipment request to get started.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Recent booking requests */}
        <Panel
          title="Recent shipment requests"
          className="lg:col-span-2"
          action={<SecondaryLink href="/customer/shipment-history">View all</SecondaryLink>}
        >
          {recentRequests.length === 0 ? (
            <EmptyState
              icon={<Package size={16} />}
              title="No shipment history yet"
              description="Submit a Shipment Request, or ask our team at the counter."
            />
          ) : (
            <ul className="divide-y divide-line">
              {recentRequests.map((r) => {
                const status = r.status as BookingRequestStatus;
                return (
                  <li key={r.id}>
                    <Link
                      href={`/customer/shipment-history/${r.request_id}`}
                      className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-line/20 group"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-xs text-accent">{r.request_id}</p>
                        <p className="mt-0.5 truncate text-xs text-muted">
                          To {r.receiver.name} ·{" "}
                          {r.receiver.address.city || r.receiver.address.province || "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusPill status={REQUEST_STATUS_LABELS[status] ?? r.status} />
                        <ArrowRight size={13} className="text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {/* Notifications */}
        <Panel
          title="Recent updates"
        >
          {recentNotifications.length === 0 ? (
            <EmptyState
              icon={<Bell size={16} />}
              title="No updates yet"
              description="We'll let you know when a request is accepted or a shipment moves."
            />
          ) : (
            <ul className="divide-y divide-line">
              {recentNotifications.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.href}
                    className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-line/20"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground leading-snug">{n.title}</p>
                      <p className="mt-0.5 text-[11px] text-muted flex items-center gap-1">
                        <Clock size={10} />
                        {new Date(n.at).toLocaleDateString("en-PH", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Shortcuts */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            href: "/customer/shipments",
            icon: Truck,
            iconColor: "text-blue-500",
            iconBg: "bg-blue-50 dark:bg-blue-950/40",
            label: "Your shipments",
            sub: "Status and tracking",
          },
          {
            href: "/customer/documents",
            icon: FileText,
            iconColor: "text-violet-500",
            iconBg: "bg-violet-50 dark:bg-violet-950/40",
            label: "Documents",
            sub: "Proof of Delivery",
          },
          {
            href: "/customer/profile",
            icon: UserCircle,
            iconColor: "text-emerald-500",
            iconBg: "bg-emerald-50 dark:bg-emerald-950/40",
            label: "Your profile",
            sub: "Name and address",
          },
        ].map(({ href, icon: Icon, iconColor, iconBg, label, sub }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-lg border border-line bg-background px-4 py-4 transition-colors hover:bg-line/20 group"
          >
            <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
              <Icon size={16} className={iconColor} />
            </div>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-foreground">{label}</span>
              <span className="block text-xs text-muted">{sub}</span>
            </span>
            <ArrowRight size={14} className="shrink-0 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        ))}
      </div>
    </div>
  );
}
