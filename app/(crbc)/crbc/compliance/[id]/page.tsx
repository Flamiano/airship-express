import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { notFound } from "next/navigation";
import { getComplianceById } from "@/app/(crbc)/services/compliance.service";
import { getAllCustomers } from "@/app/(crbc)/services/crm.service";
import { formatDate } from "@/app/(crbc)/library/utils/formattedate";

const statusStyle = {
  Compliant: "bg-emerald-50 text-emerald-600",
  Pending: "bg-amber-50 text-amber-600",
  "Non-Compliant": "bg-red-50 text-red-600",
};

function CheckItem({
  label,
  complete,
}: {
  label: string;
  complete: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-2.5">
        {complete ? (
          <CheckCircle2
            size={15}
            className="text-emerald-500"
          />
        ) : (
          <XCircle
            size={15}
            className="text-red-500"
          />
        )}

        <span className="text-xs text-zinc-700">
          {label}
        </span>
      </div>

      <span
        className={`text-xs ${
          complete
            ? "text-emerald-600"
            : "text-red-500"
        }`}
      >
        {complete ? "Complete" : "Missing"}
      </span>
    </div>
  );
}

export default async function ComplianceDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [compliance, customers] = await Promise.all([
    getComplianceById(id),
    getAllCustomers(),
  ]);

  if (!compliance) {
    notFound();
  }

  const customer = customers.find(
    (c) => c.customer_id === compliance.customer_id
  );

  const completedChecks = [
    compliance.customer_information,
    compliance.shipment_information,
    compliance.pod,
  ].filter(Boolean).length;

  const totalChecks = 3;

  const stats = [
    {
      label: "Compliance Checks",
      value: `${completedChecks}/${totalChecks}`,
    },
    {
      label: "Customer Information",
      value: compliance.customer_information
        ? "Complete"
        : "Missing",
    },
    {
      label: "Shipment Information",
      value: compliance.shipment_information
        ? "Complete"
        : "Missing",
    },
    {
      label: "POD",
      value: compliance.pod
        ? "Available"
        : "Missing",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-6">

      {/* Back */}
      <Link
        href="/crbc/compliance"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
      >
        <ArrowLeft size={13} />
        Back to Compliance
      </Link>

      {/* Title */}
      <h1 className="text-xl font-semibold text-zinc-800">
        Compliance Details
      </h1>

      {/* Compliance Summary */}
      <div className="bg-white border border-zinc-100 rounded-xl p-6">

        <div className="flex items-start justify-between gap-4">

          <div>
            <div>
              <span className="font-mono text-xs text-zinc-400">
                Compliance ID:
              </span>

              <span className="font-mono text-xs text-zinc-700 ml-1">
                {compliance.compliance_id}
              </span>
            </div>

            <div className="flex items-baseline gap-x-1 mt-1">
              <span className="text-zinc-400 text-xs">
                Shipment ID:
              </span>

              <span className="text-zinc-800 text-xs font-medium">
                {compliance.shipment_id}
              </span>
            </div>

            <div className="flex items-baseline gap-x-1 mt-1">
              <span className="text-zinc-400 text-xs">
                Customer:
              </span>

              <span className="text-zinc-800 text-xs">
                {customer?.full_name ??
                  compliance.customer_id}
              </span>
            </div>
          </div>

          {/* Status */}
          <span
            className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap ${
              statusStyle[compliance.status]
            }`}
          >
            {compliance.status}
          </span>

        </div>

        <div className="mt-4 pt-4 border-t border-zinc-50 grid grid-cols-2 gap-3 text-xs">
          <div>

            <p className="text-zinc-700 mt-0.5">
              {formatDate(compliance.reviewed_at)}
            </p>
          </div>

        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

        {stats.map(({ label, value }) => (
          <div
            key={label}
            className="bg-white border border-zinc-100 rounded-xl p-4"
          >
            <p className="text-zinc-400 text-xs">
              {label}
            </p>

            <p className="text-zinc-900 text-lg font-semibold mt-2">
              {value}
            </p>
          </div>
        ))}

      </div>

      {/* Compliance Checks */}
      <div className="bg-white border border-zinc-100 rounded-xl">

        <div className="px-5 py-4 border-b border-zinc-100">
          <h2 className="text-zinc-800 text-sm font-medium">
            Compliance Checks
          </h2>
        </div>

        <div className="divide-y divide-zinc-50">

          <CheckItem
            label="Customer Information"
            complete={
              compliance.customer_information
            }
          />

          <CheckItem
            label="Shipment Information"
            complete={
              compliance.shipment_information
            }
          />

          <CheckItem
            label="Proof of Delivery (POD)"
            complete={compliance.pod}
          />

        </div>
      </div>

      {/* Review / Remarks */}
      <div className="bg-white border border-zinc-100 rounded-xl">

        <div className="px-5 py-4 border-b border-zinc-100">
          <h2 className="text-zinc-800 text-sm font-medium">
            Review Remarks
          </h2>
        </div>

        <div className="px-5 py-4">

          {compliance.remarks ? (
            <p className="text-xs text-zinc-600 leading-relaxed">
              {compliance.remarks}
            </p>
          ) : (
            <p className="text-xs text-zinc-400">
              No remarks recorded.
            </p>
          )}

        </div>
      </div>

    </div>
  );
}