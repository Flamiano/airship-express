import { getCurrentUser } from "../../library/auth/getCurrentUser";
import {
  getCustomerById,
  getShipmentsByCustomerId,
} from "../../services/crm.service";
import { getDocumentsByCustomerId } from "../../services/document.service";
import {
  Package,
  FileText,
  CheckCircle,
} from "lucide-react";



const statusStyle: Record<string, string> = {
  Completed: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  "In Transit": "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  Pending: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  Cancelled: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

export default async function CustomerDashboard() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return null;
  }

  const customerId = currentUser.customer.customer_id;

  const [customer, shipments, documents] = await Promise.all([
    getCustomerById(customerId),
    getShipmentsByCustomerId(customerId),
    getDocumentsByCustomerId(customerId),
  ]);

  const active = shipments.filter(
    (s) =>
      s.status === "In Transit" ||
      s.status === "Pending"
  );

  const delivered = shipments.filter(
    (s) => s.status === "Completed"
  );

  const kpis = [
    {
      label: "Total Shipments",
      value: active.length,
      icon: Package,
      color: "text-blue-500 dark:text-blue-400",
    },
    {
      label: "On Going",
      value: delivered.length,
      icon: CheckCircle,
      color: "text-emerald-500 dark:text-emerald-400",
    },
    {
      label: "Delivered",
      value: documents.length,
      icon: FileText,
      color: "text-purple-500 dark:text-purple-400",
    },
  ];

  return (
    <div className="w-full py-4 space-y-6">
      <div>
        <h1 className="text-foreground text-xl font-semibold">
          Welcome, {customer?.full_name}
        </h1>

        <p className="text-muted text-sm mt-0.5">
          {customer?.customer_id}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {kpis.map(
          ({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="bg-paper border border-line rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-muted text-xs">
                  {label}
                </span>

                <Icon size={14} className={color} />
              </div>

              <p className="text-foreground text-2xl font-semibold">
                {value}
              </p>
            </div>
          )
        )}
      </div>

      {/* Active Shipments */}
      <div className="bg-paper border border-line rounded-xl">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="text-foreground text-sm font-medium">
            Recent Shipments
          </h2>
        </div>

        {active.length === 0 ? (
          <p className="px-5 py-8 text-center text-muted text-xs">
            No active shipments.
          </p>
        ) : (
          <div className="divide-y divide-line/50">
            {active.map((s) => (
              <div
                key={s.shipmentId}
                className="px-5 py-3.5 flex items-center justify-between"
              >
                <div>
                  <p className="text-foreground text-xs font-medium">
                    {s.shipmentId}
                  </p>

                  <p className="text-muted text-xs">
                    {s.origin} → {s.destination}
                  </p>
                </div>

                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    statusStyle[s.status]
                  }`}
                >
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
