import React from "react";
import { Sidebar } from "../fmscomponents/dashboard/Sidebar";
import { Navbar } from "../fmscomponents/dashboard/Navbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen w-full bg-background text-foreground flex overflow-hidden transition-colors duration-200">
      <Sidebar />

      <div className="flex-1 min-w-0 h-screen flex flex-col">
        <Navbar />

        <main className="flex-1 min-w-0 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}