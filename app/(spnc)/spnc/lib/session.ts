import { SignJWT, jwtVerify } from "jose";

const secretKey = new TextEncoder().encode(process.env.SESSION_SECRET);
const COOKIE_NAME = "session";

export type SessionPayload = {
  userId: string;
  email: string;
  full_name: string;
  role?: string;
};

export function normalizeSessionRole(role?: string | null) {
  const normalized = role?.trim().toLowerCase().replace(/[\s-]+/g, "_");

  if (normalized?.includes("admin")) return "admin";
  if (normalized?.includes("manager")) return "manager";

  return normalized || "staff";
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey);
}

export async function verifySessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;