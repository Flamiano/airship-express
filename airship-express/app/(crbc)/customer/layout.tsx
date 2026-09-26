import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../library/auth/getCurrentUser";
import CustomerLayout from "../components/layout/CustomerLayout";


export const metadata: Metadata = {
  title: "Customer Portal"
};

export default async function CustomerLayoutPage({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/customerportalAuth/login");
  }

  return (
    <CustomerLayout
      user={currentUser.authUser}
      customer={currentUser.customer}
    >
      {children}
    </CustomerLayout>
  );
}
