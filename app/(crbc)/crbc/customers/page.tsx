import { getAllCustomers } from "../../services/crm.service";
import CustomerManagement from "../../components/CustomerManagement";

export default async function CustomersPage() {
  const customers = await getAllCustomers();

  return (
    <CustomerManagement initialCustomers={customers} />
  );
}