import { useMemo } from "react";
import { ROBOT_COLORS } from "../config/chatbotConfig";
import type { RobotState } from "../types/chatbot";

export interface RobotVisualState {
  label: string;
  eyeColor: string;
  ledColor: string;
  pulseSpeed: number;
  headTiltDeg: number;
  leanForward: number;
}

const STATE_MAP: Record<RobotState, RobotVisualState> = {
  idle: { label: "Online", eyeColor: ROBOT_COLORS.eyeIdle, ledColor: ROBOT_COLORS.ledOnline, pulseSpeed: 0.6, headTiltDeg: 0, leanForward: 0 },
  thinking: { label: "Thinking", eyeColor: ROBOT_COLORS.eyeThinking, ledColor: ROBOT_COLORS.ledOnline, pulseSpeed: 1.6, headTiltDeg: 6, leanForward: 0 },
  listening: { label: "Listening", eyeColor: ROBOT_COLORS.eyeListening, ledColor: ROBOT_COLORS.ledOnline, pulseSpeed: 1.1, headTiltDeg: -3, leanForward: 0.06 },
  speaking: { label: "Speaking", eyeColor: ROBOT_COLORS.eyeSpeaking, ledColor: ROBOT_COLORS.ledOnline, pulseSpeed: 1.3, headTiltDeg: 0, leanForward: 0.02 },
  success: { label: "Done", eyeColor: ROBOT_COLORS.eyeSuccess, ledColor: ROBOT_COLORS.ledOnline, pulseSpeed: 1.0, headTiltDeg: 2, leanForward: 0 },
  error: { label: "Issue", eyeColor: ROBOT_COLORS.eyeError, ledColor: ROBOT_COLORS.ledError, pulseSpeed: 2.2, headTiltDeg: -4, leanForward: 0 },
  loading: { label: "Working", eyeColor: ROBOT_COLORS.eyeThinking, ledColor: ROBOT_COLORS.ledOnline, pulseSpeed: 1.8, headTiltDeg: 4, leanForward: 0 },
};

export function useRobotAnimation(state: RobotState): RobotVisualState {
  return useMemo(() => STATE_MAP[state] || STATE_MAP.idle, [state]);
}
