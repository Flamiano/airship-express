import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";

export const FTM_PASSKEY_ENROLLMENT_COOKIE = "ftm_passkey_enrollment";
export const FTM_PASSKEY_ENROLLMENT_TTL_SECONDS = 300;

export type FtmPasskeyEnrollmentState = {
  adminUserId: string;
  targetUserId: string;
  accessToken: string;
  refreshToken: string;
  challengeId: string;
  expiresAt: number;
};

export function isSameOriginFtmPasskeyRequest(request: NextRequest) {
  return request.headers.get("origin") === request.nextUrl.origin;
}

function getEncryptionKey() {
  const encodedKey = process.env.FTM_PASSKEY_ENROLLMENT_KEY;
  if (!encodedKey) throw new Error("FTM_PASSKEY_ENROLLMENT_KEY is not configured.");
  const key = /^[a-f\d]{64}$/i.test(encodedKey)
    ? Buffer.from(encodedKey, "hex")
    : Buffer.from(encodedKey, "base64");
  if (key.length !== 32) throw new Error("FTM_PASSKEY_ENROLLMENT_KEY must be a 32-byte key in hexadecimal or base64 format.");
  return key;
}

export function sealFtmPasskeyEnrollment(state: FtmPasskeyEnrollmentState) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(state), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function openFtmPasskeyEnrollment(value: string): FtmPasskeyEnrollmentState {
  const [ivPart, tagPart, ciphertextPart, ...extra] = value.split(".");
  if (!ivPart || !tagPart || !ciphertextPart || extra.length) throw new Error("Invalid enrollment session.");

  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  const state = JSON.parse(plaintext) as FtmPasskeyEnrollmentState;

  if (!state.adminUserId || !state.targetUserId || !state.accessToken || !state.refreshToken || !state.challengeId || !Number.isFinite(state.expiresAt)) {
    throw new Error("Invalid enrollment session data.");
  }
  if (state.expiresAt <= Date.now()) throw new Error("The passkey registration request expired. Start again.");
  return state;
}

export function ftmPasskeyEnrollmentCookieOptions(maxAge = FTM_PASSKEY_ENROLLMENT_TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/api/admin/users/",
    maxAge,
  };
}