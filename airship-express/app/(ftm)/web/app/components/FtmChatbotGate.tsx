"use client";

import { usePathname } from "next/navigation";
import FleetAIChatbot from "../../components/fleet-ai/FleetAIChatbot";

export default function FtmChatbotGate() {
  const pathname = usePathname();

  if (pathname === "/ftmAuth") return null;

  return <FleetAIChatbot />;
}
