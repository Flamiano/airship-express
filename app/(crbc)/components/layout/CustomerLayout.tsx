"use client";

import { useState } from "react";
import CustomerSidebar from "./CustomerSidebar";
import type { User } from "@supabase/supabase-js";
import type { Customers as Customer } from "../../types/customer";

type CustomerLayoutProps = {
  children: React.ReactNode;
  user: User;
  customer: Customer;
};
export default function CustomerLayout({
  children,
  customer,
}:CustomerLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="flex min-h-screen bg-background">
      <CustomerSidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        customer={customer}
      />

      <main
        className={`${
          collapsed ? "ml-16" : "ml-56"
        } flex-1 transition-all duration-200 p-6 md:p-8 overflow-x-auto`}
      >
        {children}
      </main>
    </div>
  );
}
