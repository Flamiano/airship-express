"use client";

import { useEffect, useRef } from "react";
import CursorGlow from "./CursorGlow";

export default function CursorHost() {
  const containerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const body = document.body;
    containerRef.current = body;
    body.classList.add("custom-cursor-hidden");

    return () => {
      body.classList.remove("custom-cursor-hidden");
    };
  }, []);

  return <CursorGlow containerRef={containerRef} />;
}
