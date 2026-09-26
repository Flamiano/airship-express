"use client";

import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";

const FleetAIChatbot = dynamic(() => import("../../components/fleet-ai/FleetAIChatbot"), { ssr: false });

export default function FtmChatbotGate() {
  const pathname = usePathname();

  if (pathname === "/ftmAuth") return null;

  return <FleetAIChatbot />;
}
