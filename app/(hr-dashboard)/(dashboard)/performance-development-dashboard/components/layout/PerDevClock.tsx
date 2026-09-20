"use client";

import { useEffect, useState } from "react";

const TIMEZONE = "Asia/Manila";

export function PerDevClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = now.toLocaleTimeString("en-US", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const date = now.toLocaleDateString("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      className="hidden sm:flex flex-col items-end leading-none text-right"
      suppressHydrationWarning
    >
      <span className="text-[13px] font-medium tabular-nums text-ink">
        {time}
      </span>
      <span className="mt-0.5 text-[10.5px] text-muted">{date}</span>
    </div>
  );
}
