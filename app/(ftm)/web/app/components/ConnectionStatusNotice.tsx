"use client";

import { useEffect, useState } from "react";
import { useFtmSettings } from "./FtmSettingsProvider";

type NoticeState = "slow" | "offline" | null;

export default function ConnectionStatusNotice() {
  const { settings } = useFtmSettings();
  const [notice, setNotice] = useState<NoticeState>(null);

  useEffect(() => {
    const handleOnline = () => setNotice(null);
    const handleOffline = () => setNotice("offline");
    const handleSlowRequest = () => setNotice((current) => current === "offline" ? current : "slow");
    const handleRequestFinished = () => {
      if (navigator.onLine) setNotice(null);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("ftm:network-slow", handleSlowRequest);
    window.addEventListener("ftm:network-finished", handleRequestFinished);
    if (!navigator.onLine) setNotice("offline");

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("ftm:network-slow", handleSlowRequest);
      window.removeEventListener("ftm:network-finished", handleRequestFinished);
    };
  }, []);

  if (!notice || !settings.system.networkNotices) return null;

  const isOffline = notice === "offline";
  return (
    <div className="fixed inset-x-0 top-0 z-[4000] flex justify-center px-4 pt-3" role="status" aria-live="polite">
      <div className="flex max-w-xl items-center gap-3 rounded-full border border-[#f2b8cf] bg-[#fff7fb] px-4 py-2.5 text-sm font-medium text-[#5f1838] shadow-lg shadow-pink-950/10">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#e5167e]" aria-hidden="true" />
        <span>
          {isOffline
            ? "You are offline. We will reconnect automatically when the connection returns."
            : "Your connection is taking a little longer. We are still working on it."}
        </span>
      </div>
    </div>
  );
}
