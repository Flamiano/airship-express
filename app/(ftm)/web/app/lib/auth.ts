import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import { fetchJson } from "./api";
import { getDashboardRouteForRole, normalizeRole, type AppRole } from "./roleAccess";

export type AuthUser = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  role?: AppRole | null;
};

export function mapSupabaseUser(user: User | null): AuthUser | null {
  if (!user) return null;

  const profileRole = (user as User & { role?: string | null }).role;
  const role = normalizeRole(
    profileRole
      ?? user.app_metadata?.role
      ?? user.user_metadata?.role
      ?? null
  );
  return {
    id: user.id,
    email: user.email,
    full_name: user.user_metadata?.full_name ?? null,
    role,
  };
}

export function persistAuthUser(user: AuthUser | null) {
  if (typeof window === "undefined") return;

  if (!user) {
    window.localStorage.removeItem("role");
    window.localStorage.removeItem("appRole");
    window.localStorage.removeItem("userRole");
    window.localStorage.removeItem("email");
    window.localStorage.removeItem("displayName");
    return;
  }

  const role = user.role;
  if (!role) {
    persistAuthUser(null);
    return;
  }
  window.localStorage.setItem("role", role);
  window.localStorage.setItem("appRole", role);
  window.localStorage.setItem("userRole", role);
  window.localStorage.setItem("email", user.email ?? "");
  window.localStorage.setItem("displayName", user.full_name ?? user.email ?? "");
}

const PASSKEY_VERIFIED_SESSION_KEY = "ftm-passkey-verified-user";
const DEVICE_ID_KEY = "ftm-passkey-device-id";
const DEVICE_USERS_KEY = "ftm-passkey-device-users";
const DEFAULT_MAX_USERS_PER_DEVICE = 1;

function getPasskeyDeviceId() {
  if (typeof window === "undefined") return null;
  const existing = window.localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const id = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

function getDeviceUserIds() {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(DEVICE_USERS_KEY) || "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function getMaxUsersPerDevice() {
  if (typeof window === "undefined") return DEFAULT_MAX_USERS_PER_DEVICE;
  try {
    const settings = JSON.parse(window.localStorage.getItem("ftm-security-settings") || "{}");
    const limit = Number(settings.maxUsersPerDevice);
    return Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_MAX_USERS_PER_DEVICE;
  } catch {
    return DEFAULT_MAX_USERS_PER_DEVICE;
  }
}

export function canRegisterPasskeyForDevice(userId: string) {
  const users = getDeviceUserIds();
  return users.includes(userId) || users.length < getMaxUsersPerDevice();
}

export function getPasskeyDeviceLimitMessage() {
  return `This browser device has reached the administrator limit of ${getMaxUsersPerDevice()} user${getMaxUsersPerDevice() === 1 ? "" : "s"}. Remove a device enrollment or ask an administrator to increase the limit.`;
}

export function recordPasskeyUserOnDevice(userId: string) {
  if (typeof window === "undefined") return;
  getPasskeyDeviceId();
  const users = getDeviceUserIds();
  if (!users.includes(userId)) window.localStorage.setItem(DEVICE_USERS_KEY, JSON.stringify([...users, userId]));
}

export function markPasskeyVerified(userId: string) {
  if (typeof window !== "undefined") window.sessionStorage.setItem(PASSKEY_VERIFIED_SESSION_KEY, userId);
}

export function hasPasskeyVerified(userId: string) {
  return typeof window !== "undefined" && window.sessionStorage.getItem(PASSKEY_VERIFIED_SESSION_KEY) === userId;
}

export function clearPasskeyVerified() {
  if (typeof window !== "undefined") window.sessionStorage.removeItem(PASSKEY_VERIFIED_SESSION_KEY);
}

export async function signInWithPassword(email: string, password: string) {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001";
  let response: Response;
  try {
    response = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return {
      user: null,
      error: new Error(`Unable to connect to the FTM backend at ${base}. Start the backend server and try again.`),
    };
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const authError = new Error(body.error || "Unable to sign in") as Error & { code?: string };
    authError.code = body.code;
    return { user: null, error: authError };
  }

  const session = body.session;
  if (!session?.access_token || !session.refresh_token) {
    return { user: null, error: new Error("Authentication did not return a valid session") };
  }
  const user = mapSupabaseUser(body.user ? {
    ...body.user,
    app_metadata: body.user.app_metadata || {},
    user_metadata: body.user.user_metadata || {},
    role: body.user.role,
  } as User & { role?: string | null } : null);
  if (!user) return { user: null, error: new Error("Authentication did not return a user") };
  if (user.role === "driver") {
    return { user: null, error: new Error("Driver accounts cannot access the FTM web portal.") };
  }

  persistAuthUser(user);
  clearPasskeyVerified();
  const { error: sessionError } = await supabase.auth.setSession(session);
  if (sessionError) {
    persistAuthUser(null);
    return { user: null, error: sessionError };
  }

  return { user, error: null };
}

export async function signUpWithPassword(
  email: string,
  password: string,
  full_name: string,
  role: AppRole
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name,
        role,
      },
    },
  });

  return { user: mapSupabaseUser(data.user ?? null), error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut({ scope: "local" });
  persistAuthUser(null);
  clearPasskeyVerified();
  return { error: error && error.status === 403 ? null : error };
}

export async function requestSensitiveOtp() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) throw new Error("Your account has no verified email address");

  return requestEmailMfaCode(user.email);
}

export async function requestEmailMfaCode(email: string) {
  const trimmedEmail = String(email ?? "").trim();
  if (!trimmedEmail) throw new Error("Email address is required.");

  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001";
  const response = await fetch(`${base}/api/auth/request-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: trimmedEmail }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || "Unable to send the verification email.");
  }

  return {
    sent: true,
    message: body.message || "A 6-digit verification code was sent to your email address.",
    expiresAt: Number(body.expiresAt) || Date.now() + (Number(body.expiresInSeconds) || 300) * 1000,
    resendAvailableAt: Number(body.resendAvailableAt) || Date.now(),
  };
}

export async function updateOtpExpirationPolicy(otpLifetimeSeconds: number) {
  return fetchJson("/api/auth/otp-policy", {
    method: "PATCH",
    body: JSON.stringify({ otpLifetimeSeconds }),
  }) as Promise<{ otpLifetimeSeconds: number }>;
}

export async function getOtpExpirationPolicy() {
  return fetchJson("/api/auth/otp-policy") as Promise<{ otpLifetimeSeconds: number }>;
}

export async function verifySensitiveOtp(code: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) throw new Error("Your account has no verified email address");

  return verifyEmailMfaCode(user.email, code);
}

export async function verifyEmailMfaCode(email: string, code: string) {
  const trimmedEmail = String(email ?? "").trim();
  const normalizedCode = String(code ?? "").replace(/\D/g, "");

  if (!trimmedEmail || !normalizedCode || normalizedCode.length !== 6) {
    throw new Error("Enter the 6-digit code from your email.");
  }

  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001";
  const response = await fetch(`${base}/api/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: trimmedEmail, code: normalizedCode }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || "The verification code is invalid or expired.");
  }

  return { verified: Boolean(body.verified) };
}

export function getUserFriendlyAuthError(rawError: unknown, context: "signin" | "otp" | "passkey" = "signin") {
  const message = typeof rawError === "string"
    ? rawError
    : rawError instanceof Error
      ? rawError.message
      : "";

  const normalized = message.toLowerCase();
  const errorName = typeof rawError === "object" && rawError !== null && "name" in rawError
    ? String((rawError as { name?: unknown }).name || "")
    : "";

  if (!normalized) {
    if (context === "signin") return "We couldn’t sign you in. Please check your email and password and try again.";
    if (context === "otp") return "We couldn’t verify your sign-in code. Please try again and check your inbox.";
    if (context === "passkey") return "We couldn’t verify your device passkey. Please try again or register a new passkey.";
    return "We couldn’t complete this sign-in step. Please try again.";
  }

  if (/(invalid login credentials|invalid credentials|wrong password|incorrect password|invalid email or password|email or password is invalid|authentication failed|login failed|user not found|no user found|failed to authenticate|account temporarily locked)/i.test(normalized)) {
    return "We couldn’t sign you in. Please check your email and password and try again.";
  }

  if (/(email not confirmed|verify your email|confirm your email|email verification)/i.test(normalized)) {
    return "This account still needs email verification. Please check your inbox or request a new verification code.";
  }

  if (/(too many requests|rate limit|429|temporarily blocked|too many attempts)/i.test(normalized)) {
    return "This sign-in request was blocked temporarily because of repeated attempts. Please wait a moment and try again.";
  }

  if (/(prompt was canceled|prompt was cancelled|user canceled|user cancelled|operation was canceled|operation was cancelled)/i.test(normalized) || (errorName === "NotAllowedError" && /(cancel|canceled|cancelled|abort|timeout|timed out)/i.test(normalized))) {
    return "Passkey verification was canceled. Choose your saved passkey and try again.";
  }

  if (errorName === "NotAllowedError" && /(rp|relying party|origin|domain|credential|recognize|found|available)/i.test(normalized)) {
    return "This saved passkey is not available for this browser address or profile. Use the same browser address where it was registered, or register a new device passkey.";
  }

  if (errorName === "InvalidStateError" || /(already registered|already exists|duplicate|credential.*(exists|registered)|device.*registered|try a different device)/i.test(normalized)) {
    return "This device already has a passkey for this account. Use the existing passkey or register another authenticator.";
  }

  if (errorName === "NotSupportedError" || errorName === "SecurityError" || /(secure context|not supported|rp id|relying party|origin)/i.test(normalized)) {
    return "Passkeys are unavailable at this browser address. Use HTTPS or localhost and the same browser address where the passkey was registered.";
  }

  if (/(verification code.*invalid|otp.*invalid|one-time code.*invalid|code.*expired|expired code|incorrect code|invalid.*code)/i.test(normalized)) {
    return "The verification code did not match. Please check the code in your email and try again.";
  }

  if (/(unable to connect|fetch failed|network|service unavailable|backend|server error|timed out)/i.test(normalized)) {
    return "We couldn’t reach the sign-in service. Please try again in a moment.";
  }

  if (/(email address is required|required.*email|enter the 6-digit code|invalid code)/i.test(normalized)) {
    return "Please enter the 6-digit code sent to your email to continue.";
  }

  if (context === "otp") {
    return "We couldn’t send or verify the sign-in code. Please try again in a moment.";
  }

  if (context === "passkey") {
    const origin = typeof window !== "undefined" ? window.location.origin : "this browser address";
    return `This saved passkey could not be used at ${origin}. Passkeys are tied to the address where they were registered. Use the same address, or choose Create a new passkey on this device.`;
  }

  return "We couldn’t complete the sign-in request. Please try again or contact support if the problem continues.";
}

export function getDashboardRouteForAuthUser(user: AuthUser | null) {
  return getDashboardRouteForRole(user?.role);
}
