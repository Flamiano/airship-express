import { getDocuments } from "../../services/document.service";
import { getAllCustomers } from "../../services/crm.service";
import EDocumentationManagement from "../../components/EDocumentationManagement";

export default async function EDocumentationPage() {
  const [documents, customers] = await Promise.all([
    getDocuments(),
    getAllCustomers(),
  ]);

  return (
    <EDocumentationManagement
      initialDocuments={documents}
      initialCustomers={customers}
    />
  );
}