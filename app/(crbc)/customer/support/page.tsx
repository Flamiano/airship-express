import { redirect } from "next/navigation";
import { getCurrentUser } from "../../library/auth/getCurrentUser";
import { CustomerSupportChat } from "./CustomerSupportChat";

export default async function CustomerSupportPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/customerportalAuth/login");

  return (
    <CustomerSupportChat
      userId={currentUser.authUser.id}
      displayName={currentUser.profile.full_name ?? currentUser.profile.email}
    />
  );
}
