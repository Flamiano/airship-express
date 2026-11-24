"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";

const FleetAIChatbot = dynamic(() => import("./fleet-ai/FleetAIChatbot"), { ssr: false });
const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export default function FtmChatbotGate() {
  const isMounted = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  if (!isMounted) return null;
  return <FleetAIChatbot />;
}
