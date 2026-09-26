"use client";

import CustomerNavbar from "./CustomerSidebar";
import type { User } from "@supabase/supabase-js";
import type { Customers as Customer } from "../../types/customer";

type CustomerLayoutProps = {
  children: React.ReactNode;
  user: User;
  customer: Customer;
};

export default function CustomerLayout({ children, customer }: CustomerLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <CustomerNavbar customer={customer} />
      <main className="pt-14 px-4 md:px-8 overflow-x-auto">
        {children}
      </main>
    </div>
  );
}
