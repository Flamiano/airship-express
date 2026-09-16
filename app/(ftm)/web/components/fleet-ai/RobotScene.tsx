"use client";

import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import Robot3D from "./Robot3D";
import FleetContext from "./FleetContext";
import { useRobotAnimation } from "./hooks/useRobotAnimation";
import type { RobotState } from "./types/chatbot";

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

/** Lightweight 2D fallback shown when WebGL is unavailable, so the chatbot
 * still works everywhere - it just doesn't get a 3D robot. */
function RobotFallback({ state }: { state: RobotState }) {
  const visual = useRobotAnimation(state);
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div
        className="relative flex h-24 w-24 items-center justify-center rounded-[28px] border border-white/10 shadow-inner transition-colors duration-500"
        style={{ background: "linear-gradient(160deg,#e8ebf0,#c7ccd6)" }}
      >
        <div className="flex gap-3">
          <span
            className="h-3 w-3 rounded-full transition-colors duration-300"
            style={{ backgroundColor: visual.eyeColor, boxShadow: `0 0 8px ${visual.eyeColor}` }}
          />
          <span
            className="h-3 w-3 rounded-full transition-colors duration-300"
            style={{ backgroundColor: visual.eyeColor, boxShadow: `0 0 8px ${visual.eyeColor}` }}
          />
        </div>
        <span
          className="absolute bottom-3 h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: visual.ledColor, boxShadow: `0 0 6px ${visual.ledColor}` }}
        />
      </div>
    </div>
  );
}

export default function RobotScene({ state, active }: { state: RobotState; active: boolean }) {
  const [webglOk, setWebglOk] = useState<boolean | null>(null);

  useEffect(() => {
    setWebglOk(detectWebGL());
  }, []);

  if (webglOk === null) return <div className="h-full w-full" aria-hidden />;
  if (!webglOk) return <RobotFallback state={state} />;
  if (!active) return null; // don't keep the WebGL context alive while closed

  return (
    <Canvas
      dpr={[1, 1.6]}
      camera={{ position: [0, 0.1, 3.1], fov: 32 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      frameloop="always"
      aria-label="Fleet AI 3D robot assistant"
    >
      <ambientLight intensity={0.65} />
      <directionalLight position={[2, 3, 2]} intensity={1.1} castShadow={false} />
      <directionalLight position={[-2, 1, -2]} intensity={0.35} color="#8ecbff" />
      <Suspense fallback={null}>
        <Robot3D state={state} />
        <FleetContext />
      </Suspense>
    </Canvas>
  );
}
