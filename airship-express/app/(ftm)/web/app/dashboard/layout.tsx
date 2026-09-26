import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";

export const metadata: Metadata = {
  title: "Airship Express - Command Center",
  description: "Logistics command center dashboard",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
