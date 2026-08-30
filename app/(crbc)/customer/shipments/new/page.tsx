import { getCurrentUser } from "../../../library/auth/getCurrentUser";
import RequestShipmentForm from "../../../components/customer/RequestShipmentForm";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Request Shipment",
};

export default async function RequestShipmentPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/customerportalAuth/login");
  }

  return <RequestShipmentForm />;
}
