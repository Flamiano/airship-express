import type { ComplianceRecord } from "../types/compliance.requirement";
export const complianceRecords: ComplianceRecord[] = [
  {
    compliance_id: "COMP-0001",
    shipment_id: "SHP-0001",
    customer_id: "CUS-0001",

    status: "Compliant",

    reviewed_at: "2026-08-16T10:30:00+08:00",
    reviewed_by: "CSR-0001",

    customer_information: true,
    shipment_information: true,
    pod: true,

    remarks: null,
  },

  {
    compliance_id: "COMP-0002",
    shipment_id: "SHP-0002",
    customer_id: "CUS-0002",

    status: "Pending",

    reviewed_at: "2026-08-16T10:30:00+08:00",
    reviewed_by: null,

    customer_information: true,
    shipment_information: true,
    pod: false,

    remarks: "POD is not yet available.",
  },

  {
    compliance_id: "COMP-0003",
    shipment_id: "SHP-0003",
    customer_id: "CUS-0003",

    status: "Non-Compliant",

    reviewed_at: "2026-08-15T15:20:00+08:00",
    reviewed_by: "CSR-0002",

    customer_information: true,
    shipment_information: false,
    pod: false,

    remarks: "Shipment information is incomplete and POD is unavailable.",
  },

  {
    compliance_id: "COMP-0004",
    shipment_id: "SHP-0004",
    customer_id: "CUS-0004",

    status: "Compliant",

    reviewed_at: "2026-08-16T14:15:00+08:00",
    reviewed_by: "CSR-0001",

    customer_information: true,
    shipment_information: true,
    pod: true,

    remarks: null,
  },

  {
    compliance_id: "COMP-0005",
    shipment_id: "SHP-0005",
    customer_id: "CUS-0005",

    status: "Pending",

    reviewed_at: "2026-08-16T10:30:00+08:00",
    reviewed_by: null,

    customer_information: true,
    shipment_information: false,
    pod: true,

    remarks: "Shipment information requires verification.",
  },
];