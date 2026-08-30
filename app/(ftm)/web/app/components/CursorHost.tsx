"use client";

import { useEffect, useRef, useState } from "react";
import CursorGlow from "./CursorGlow";

export default function CursorHost() {
  const containerRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const body = document.body;
    containerRef.current = body;
    body.classList.add("custom-cursor-hidden");
    setMounted(true);

    return () => {
      body.classList.remove("custom-cursor-hidden");
    };
  }, []);

  return mounted ? <CursorGlow containerRef={containerRef} /> : null;
}
