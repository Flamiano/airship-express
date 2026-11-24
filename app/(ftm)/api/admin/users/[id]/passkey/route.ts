import { NextRequest, NextResponse } from "next/server";
import { authenticateFtmRequest } from "../../../../../lib/server/ftmRequestAuth";
import { createFtmAuthClient } from "../../../../../lib/server/ftmSupabase";
import {
  FTM_PASSKEY_ENROLLMENT_COOKIE,
  FTM_PASSKEY_ENROLLMENT_TTL_SECONDS,
  ftmPasskeyEnrollmentCookieOptions,
  isSameOriginFtmPasskeyRequest,
  openFtmPasskeyEnrollment,
  sealFtmPasskeyEnrollment,
} from "../../../../../lib/server/ftmPasskeyEnrollment";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isSameOriginFtmPasskeyRequest(request)) {
    return NextResponse.json({ error: "Passkey registration must be started from this application." }, { status: 403 });
  }
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  if (auth.context.user.role !== "admin") {
    return NextResponse.json({ error: "Only administrators can register a passkey for another user." }, { status: 403 });
  }
  if (id === auth.context.user.id) {
    return NextResponse.json({ error: "Select another user. Register your own passkey from Account Settings." }, { status: 400 });
  }

  const { data: targetResult, error: targetError } = await auth.context.serviceClient.auth.admin.getUserById(id);
  const targetUser = targetResult?.user;
  if (targetError || !targetUser?.email) {
    return NextResponse.json({ error: targetError?.message || "The selected Supabase Auth user was not found or has no email." }, { status: 404 });
  }

  const { data: existingPasskeys, error: listError } = await auth.context.serviceClient.auth.admin.passkey.listPasskeys({ userId: targetUser.id });
  if (listError) {
    console.error("[admin-passkey] Unable to check existing credentials", { adminUserId: auth.context.user.id, targetUserId: targetUser.id, error: listError.message });
    return NextResponse.json({ error: "Unable to check the selected user’s existing passkeys.", details: listError.message }, { status: 502 });
  }
  if (existingPasskeys.length > 0) {
    return NextResponse.json({ error: "The selected user already has a registered passkey.", passkeyCount: existingPasskeys.length }, { status: 409 });
  }

  const pendingAt = new Date().toISOString();
  const { error: pendingStatusError } = await auth.context.serviceClient.from("ftm_passkey_enrollment_status").upsert({
    user_id: targetUser.id,
    status: "Pending",
    registered_at: null,
    registered_by: null,
    updated_at: pendingAt,
  }, { onConflict: "user_id" });
  if (pendingStatusError) {
    console.error("[admin-passkey] Unable to initialize pending status", { adminUserId: auth.context.user.id, targetUserId: targetUser.id, error: pendingStatusError.message });
    return NextResponse.json({ error: "Unable to initialize the selected user’s passkey status.", details: pendingStatusError.message }, { status: 500 });
  }

  try {
    const { data: linkData, error: linkError } = await auth.context.serviceClient.auth.admin.generateLink({
      type: "magiclink",
      email: targetUser.email,
    });
    const tokenHash = linkData?.properties?.hashed_token;
    if (linkError || !tokenHash) {
      throw new Error(linkError?.message || "Supabase did not return a one-time target-user sign-in token.");
    }

    const targetAuthClient = createFtmAuthClient();
    const { data: targetSession, error: sessionError } = await targetAuthClient.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
    if (sessionError || !targetSession.session || targetSession.user?.id !== targetUser.id) {
      throw new Error(sessionError?.message || "Could not establish the selected user’s temporary enrollment session.");
    }

    const { data: registration, error: registrationError } = await targetAuthClient.auth.passkey.startRegistration();
    if (registrationError || !registration) {
      throw new Error(registrationError?.message || "Supabase did not return passkey registration options.");
    }

    const expiresAt = Math.min(
      Date.now() + FTM_PASSKEY_ENROLLMENT_TTL_SECONDS * 1000,
      (targetSession.session.expires_at || Math.floor(Date.now() / 1000) + FTM_PASSKEY_ENROLLMENT_TTL_SECONDS) * 1000
    );
    const sealedSession = sealFtmPasskeyEnrollment({
      adminUserId: auth.context.user.id,
      targetUserId: targetUser.id,
      accessToken: targetSession.session.access_token,
      refreshToken: targetSession.session.refresh_token,
      challengeId: registration.challenge_id,
      expiresAt,
    });

    console.info("[admin-passkey] Registration started", { adminUserId: auth.context.user.id, targetUserId: targetUser.id });
    const response = NextResponse.json({
      challengeId: registration.challenge_id,
      options: registration.options,
      expiresAt,
    });
    response.cookies.set(FTM_PASSKEY_ENROLLMENT_COOKIE, sealedSession, {
      ...ftmPasskeyEnrollmentCookieOptions(Math.max(1, Math.floor((expiresAt - Date.now()) / 1000))),
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start passkey registration.";
    console.error("[admin-passkey] Registration start failed", { adminUserId: auth.context.user.id, targetUserId: targetUser.id, error: message });
    return NextResponse.json({ error: "Unable to start passkey registration for the selected user.", details: message }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isSameOriginFtmPasskeyRequest(request)) {
    return NextResponse.json({ error: "Passkey registration must be cancelled from this application." }, { status: 403 });
  }
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  if (auth.context.user.role !== "admin") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });

  const sealedSession = request.cookies.get(FTM_PASSKEY_ENROLLMENT_COOKIE)?.value;
  if (sealedSession) {
    try {
      const enrollment = openFtmPasskeyEnrollment(sealedSession);
      if (enrollment.adminUserId !== auth.context.user.id || enrollment.targetUserId !== id) {
        return NextResponse.json({ ok: true });
      }
    } catch {
      return NextResponse.json({ ok: true });
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(FTM_PASSKEY_ENROLLMENT_COOKIE, "", ftmPasskeyEnrollmentCookieOptions(0));
  return response;
}