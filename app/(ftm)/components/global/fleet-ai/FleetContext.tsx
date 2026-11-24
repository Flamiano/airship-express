"use client";

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { ROBOT_COLORS } from "./config/chatbotConfig";

/** Lightweight holographic scene dressing: a base ring, a route curve, a
 * drifting vehicle marker, and a pulsing GPS pin. Kept intentionally sparse
 * so it never competes with the robot for attention or performance budget. */
export default function FleetContext() {
  const ringRef = useRef<THREE.Mesh>(null);
  const vehicleRef = useRef<THREE.Mesh>(null);
  const gpsRef = useRef<THREE.Mesh>(null);
  const t = useRef(0);

  const routePoints = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.9, -1.02, 0.1),
      new THREE.Vector3(-0.3, -1.05, 0.5),
      new THREE.Vector3(0.35, -1.0, 0.35),
      new THREE.Vector3(0.95, -1.05, -0.1),
    ]);
    return curve.getPoints(40);
  }, []);

  useFrame((_, delta) => {
    t.current += delta;
    if (ringRef.current) ringRef.current.rotation.z += delta * 0.15;
    if (gpsRef.current) {
      const pulse = 1 + Math.sin(t.current * 2.4) * 0.15;
      gpsRef.current.scale.setScalar(pulse);
    }
    if (vehicleRef.current) {
      const progress = (Math.sin(t.current * 0.5) + 1) / 2;
      const point = routePoints[Math.floor(progress * (routePoints.length - 1))];
      if (point) vehicleRef.current.position.lerp(point, delta * 4);
    }
  });

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      "group",
      null,
      React.createElement(
        "mesh",
        { ref: ringRef, rotation: [-Math.PI / 2, 0, 0], position: [0, -1.08, 0] },
        React.createElement("ringGeometry", { args: [0.85, 0.98, 48] }),
        React.createElement("meshBasicMaterial", {
          color: ROBOT_COLORS.accent,
          transparent: true,
          opacity: 0.28,
          side: THREE.DoubleSide,
        })
      ),
      React.createElement(Line, {
        points: routePoints,
        color: ROBOT_COLORS.accent,
        lineWidth: 1.4,
        transparent: true,
        opacity: 0.5,
      }),
      React.createElement(
        "mesh",
        { ref: vehicleRef, position: routePoints[0] },
        React.createElement("boxGeometry", { args: [0.08, 0.05, 0.04] }),
        React.createElement("meshStandardMaterial", {
          color: ROBOT_COLORS.accent,
          emissive: ROBOT_COLORS.accent,
          emissiveIntensity: 1,
          toneMapped: false,
        })
      ),
      React.createElement(
        "group",
        { position: [0.75, -0.85, -0.2] },
        React.createElement(
          "mesh",
          { ref: gpsRef },
          React.createElement("coneGeometry", { args: [0.05, 0.11, 12] }),
          React.createElement("meshStandardMaterial", {
            color: ROBOT_COLORS.eyeSuccess,
            emissive: ROBOT_COLORS.eyeSuccess,
            emissiveIntensity: 1,
            toneMapped: false,
          })
        )
      )
    )
  );
}
