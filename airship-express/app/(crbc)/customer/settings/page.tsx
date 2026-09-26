import { getCurrentUser } from "@/app/(crbc)/library/auth/getCurrentUser";
import { redirect } from "next/navigation";
import SettingsForm from "./SettingsForm";

export const metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/customerportalAuth/login");
  }

  return (
    <SettingsForm
      id={currentUser.customer.id}
      full_name={currentUser.customer.full_name}
      phone={currentUser.customer.phone}
      address={currentUser.customer.address}
      email={currentUser.customer.email}
    />
  );
}