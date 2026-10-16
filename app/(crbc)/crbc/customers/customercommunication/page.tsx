import { redirect } from "next/navigation";
import { getCurrentUser } from "../../../library/auth/getCurrentUser";
import { getOnlineCustomers } from "../../../services/crm.service";
import { CustomerCommunicationClient } from "./CustomerCommunicationClient";

export default async function CustomerCommunicationPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/crbc/login");
  if (currentUser.profile.role === "customer") redirect("/customer/dashboard");

  const customers = await getOnlineCustomers();

  return (
    <CustomerCommunicationClient
      staffId={currentUser.authUser.id}
      customers={customers}
    />
  );
}
