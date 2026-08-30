import { getComplianceRecords } from "../../services/compliance.service";
import { getAllCustomers } from "../../services/crm.service";

import ComplianceManagement from "../../components/compliance/ComplianceManagement";

export default async function CompliancePage() {
  const [records, customers] = await Promise.all([
    getComplianceRecords(),
    getAllCustomers(),
  ]);

  return (
    <ComplianceManagement
      initialRecords={records}
      initialCustomers={customers}
    />
  );
}