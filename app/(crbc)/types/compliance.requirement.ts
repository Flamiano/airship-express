
export type ComplianceStatus =
  | "Compliant"
  | "Pending"
  | "Non-Compliant";

export type ComplianceRecord = {
  compliance_id: string;
  shipment_id: string;
  customer_id: string;
  status: ComplianceStatus;
  reviewed_at: string | Date;
  reviewed_by: string | null;

  // Detailed checks
  customer_information: boolean;
  shipment_information: boolean;
  pod: boolean;

  remarks: string | null;
};