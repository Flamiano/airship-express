import { getCurrentUser } from "@/app/(crbc)/library/auth/getCurrentUser";
import { redirect } from "next/navigation";
import ProfileManagement from "./ProfileManagement";

export const metadata = {
  title: "Profile"
};

export default async function ProfileManagementPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/customerportalAuth/login");
  }

  return (
    <ProfileManagement
      customer_id={currentUser.customer.customer_id}
      full_name={currentUser.customer.full_name}
      phone={currentUser.customer.phone}
      address={currentUser.customer.address}
      email={currentUser.customer.email}
    />
  );
}