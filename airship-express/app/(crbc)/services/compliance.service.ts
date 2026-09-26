import { complianceRecords } from "../data/compliance";
import { ComplianceRecord } from "../types/compliance.requirement";

export async function getComplianceRecords(): Promise<
  ComplianceRecord[]
> {
  return complianceRecords;
}

export async function getComplianceById(
  id: string
): Promise<ComplianceRecord | null> {
  const records = await getComplianceRecords();

  return (
    records.find((record) => record.compliance_id === id) ?? null
  );
}