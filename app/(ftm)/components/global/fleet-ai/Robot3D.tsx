"use client";

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { useRobotAnimation } from "./hooks/useRobotAnimation";
import { ROBOT_COLORS } from "./config/chatbotConfig";
import type { RobotState } from "./types/chatbot";

interface Robot3DProps {
  state: RobotState;
}

function Eye({ x, color }: { x: number; color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  const blinkRef = useRef(0);

  useFrame((_, delta) => {
    if (!ref.current) return;
    blinkRef.current += delta;
    const t = blinkRef.current % 4.5;
    const blinking = t > 4.35;
    ref.current.scale.y = blinking ? 0.1 : 1;
  });

  return React.createElement(
    "mesh",
    { ref, position: [x, 0.06, 0.47] },
    React.createElement("circleGeometry", { args: [0.075, 24] }),
    React.createElement("meshStandardMaterial", {
      color,
      emissive: color,
      emissiveIntensity: 1.6,
      toneMapped: false,
    })
  );
}

function ThinkingRing({ visible }: { visible: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.z += delta * 1.4;
    ref.current.rotation.x += delta * 0.6;
  });
  if (!visible) return null;

  return React.createElement(
    "mesh",
    { ref, position: [0, 0.95, 0] },
    React.createElement("torusGeometry", { args: [0.34, 0.012, 8, 48] }),
    React.createElement("meshStandardMaterial", {
      color: ROBOT_COLORS.eyeThinking,
      emissive: ROBOT_COLORS.eyeThinking,
      emissiveIntensity: 1.2,
      toneMapped: false,
      transparent: true,
      opacity: 0.85,
    })
  );
}

export default function Robot3D({ state }: Robot3DProps) {
  const visual = useRobotAnimation(state);
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const chestLedRef = useRef<THREE.Mesh>(null);
  const clock = useRef(0);

  const bodyMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: ROBOT_COLORS.bodyPrimary, metalness: 0.55, roughness: 0.35 }),
    []
  );
  const jointMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: ROBOT_COLORS.jointDark, metalness: 0.4, roughness: 0.5 }),
    []
  );
  const faceMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: ROBOT_COLORS.jointDarker, metalness: 0.3, roughness: 0.6 }),
    []
  );

  useFrame((_, delta) => {
    clock.current += delta;
    const t = clock.current;

    if (groupRef.current) {
      const breathe = 1 + Math.sin(t * 1.4) * 0.012;
      groupRef.current.scale.set(1, breathe, 1);
      groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, visual.leanForward, delta * 3);
    }

    if (headRef.current) {
      const idleSway = Math.sin(t * 0.8) * 0.035;
      const targetTilt = THREE.MathUtils.degToRad(visual.headTiltDeg);
      headRef.current.rotation.z = THREE.MathUtils.lerp(headRef.current.rotation.z, targetTilt + idleSway * 0.3, delta * 3);
      headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, idleSway, delta * 2);

      if (state === "error") {
        headRef.current.position.x = Math.sin(t * 18) * 0.01;
      } else {
        headRef.current.position.x = THREE.MathUtils.lerp(headRef.current.position.x, 0, delta * 4);
      }
    }

    if (chestLedRef.current) {
      const pulse = 0.6 + Math.abs(Math.sin(t * visual.pulseSpeed)) * 0.6;
      (chestLedRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;
    }
  });

  return React.createElement(
    "group",
    { ref: groupRef, position: [0, -0.1, 0] },
    React.createElement(RoundedBox, {
      args: [1.05, 1.15, 0.62],
      radius: 0.16,
      smoothness: 4,
      position: [0, -0.55, 0],
      material: bodyMaterial,
    }),
    React.createElement(
      "mesh",
      { ref: chestLedRef, position: [0, -0.35, 0.32] },
      React.createElement("circleGeometry", { args: [0.07, 24] }),
      React.createElement("meshStandardMaterial", {
        color: visual.ledColor,
        emissive: visual.ledColor,
        emissiveIntensity: 1,
        toneMapped: false,
      })
    ),
    React.createElement(
      "mesh",
      { position: [-0.62, -0.15, 0], material: jointMaterial },
      React.createElement("sphereGeometry", { args: [0.18, 20, 20] })
    ),
    React.createElement(
      "mesh",
      { position: [0.62, -0.15, 0], material: jointMaterial },
      React.createElement("sphereGeometry", { args: [0.18, 20, 20] })
    ),
    React.createElement(
      "mesh",
      { position: [-0.68, -0.4, 0], rotation: [0, 0, Math.PI / 10], material: bodyMaterial },
      React.createElement("cylinderGeometry", { args: [0.12, 0.13, 0.5, 16] })
    ),
    React.createElement(
      "mesh",
      { position: [0.68, -0.4, 0], rotation: [0, 0, -Math.PI / 10], material: bodyMaterial },
      React.createElement("cylinderGeometry", { args: [0.12, 0.13, 0.5, 16] })
    ),
    React.createElement("mesh", { position: [0, 0.08, 0], material: jointMaterial }, React.createElement("cylinderGeometry", { args: [0.13, 0.15, 0.18, 20] })),
    React.createElement(
      "group",
      { ref: headRef, position: [0, 0.42, 0] },
      React.createElement(RoundedBox, {
        args: [0.62, 0.56, 0.58],
        radius: 0.22,
        smoothness: 4,
        material: bodyMaterial,
      }),
      React.createElement(
        "mesh",
        { position: [0, 0.02, 0.28], material: faceMaterial },
        React.createElement("boxGeometry", { args: [0.44, 0.24, 0.06] })
      ),
      React.createElement(Eye, { x: -0.12, color: visual.eyeColor }),
      React.createElement(Eye, { x: 0.12, color: visual.eyeColor }),
      React.createElement(
        "mesh",
        { position: [-0.33, 0.1, 0] },
        React.createElement("sphereGeometry", { args: [0.03, 12, 12] }),
        React.createElement("meshStandardMaterial", {
          color: visual.eyeColor,
          emissive: visual.eyeColor,
          emissiveIntensity: 1,
          toneMapped: false,
        })
      ),
      React.createElement(
        "mesh",
        { position: [0.33, 0.1, 0] },
        React.createElement("sphereGeometry", { args: [0.03, 12, 12] }),
        React.createElement("meshStandardMaterial", {
          color: visual.eyeColor,
          emissive: visual.eyeColor,
          emissiveIntensity: 1,
          toneMapped: false,
        })
      )
    ),
    React.createElement(ThinkingRing, { visible: state === "thinking" || state === "loading" })
  );
}
