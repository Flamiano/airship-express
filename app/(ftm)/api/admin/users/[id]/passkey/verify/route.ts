import { NextRequest, NextResponse } from "next/server";
import { authenticateFtmRequest } from "../../../../../../lib/server/ftmRequestAuth";
import { createFtmAuthClient } from "../../../../../../lib/server/ftmSupabase";
import {
  FTM_PASSKEY_ENROLLMENT_COOKIE,
  ftmPasskeyEnrollmentCookieOptions,
  isSameOriginFtmPasskeyRequest,
  openFtmPasskeyEnrollment,
} from "../../../../../../lib/server/ftmPasskeyEnrollment";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isSameOriginFtmPasskeyRequest(request)) {
    return NextResponse.json({ error: "Passkey verification must be completed from this application." }, { status: 403 });
  }
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  if (auth.context.user.role !== "admin") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });

  let response: NextResponse;
  let errorStatus = 400;
  try {
    const sealedSession = request.cookies.get(FTM_PASSKEY_ENROLLMENT_COOKIE)?.value;
    if (!sealedSession) throw new Error("The passkey registration request expired. Start again.");
    const enrollment = openFtmPasskeyEnrollment(sealedSession);
    if (enrollment.adminUserId !== auth.context.user.id || enrollment.targetUserId !== id) {
      throw new Error("This passkey registration request belongs to a different administrator or user.");
    }

    const body = await request.json().catch(() => null);
    if (!body || body.challengeId !== enrollment.challengeId || !body.credential || typeof body.credential !== "object") {
      throw new Error("The passkey registration response is invalid or does not match the active challenge.");
    }

    const targetAuthClient = createFtmAuthClient();
    const { data: sessionData, error: sessionError } = await targetAuthClient.auth.setSession({
      access_token: enrollment.accessToken,
      refresh_token: enrollment.refreshToken,
    });
    if (sessionError || sessionData.user?.id !== enrollment.targetUserId) {
      throw new Error(sessionError?.message || "The target-user enrollment session could not be verified.");
    }

    const { data: registeredPasskey, error: registrationError } = await targetAuthClient.auth.passkey.verifyRegistration({
      challengeId: enrollment.challengeId,
      credential: body.credential,
    });
    if (registrationError || !registeredPasskey) {
      throw new Error(registrationError?.message || "Supabase did not confirm the passkey registration.");
    }

    const { data: passkeys, error: listError } = await auth.context.serviceClient.auth.admin.passkey.listPasskeys({ userId: enrollment.targetUserId });
    if (listError || !passkeys.length) {
      errorStatus = 502;
      throw new Error(listError?.message || "The passkey was not found on the selected user’s Supabase Auth account after registration.");
    }

    const registeredAt = new Date().toISOString();
    const { error: statusError } = await auth.context.serviceClient.from("ftm_passkey_enrollment_status").upsert({
      user_id: enrollment.targetUserId,
      status: "Registered",
      registered_at: registeredAt,
      registered_by: auth.context.user.id,
      updated_at: registeredAt,
    }, { onConflict: "user_id" });
    if (statusError) {
      errorStatus = 500;
      console.error("[admin-passkey] Credential registered but status update failed", {
        adminUserId: auth.context.user.id,
        targetUserId: enrollment.targetUserId,
        error: statusError.message,
      });
      throw new Error(`The passkey was registered, but its database status could not be updated: ${statusError.message}`);
    }

    console.info("[admin-passkey] Registration completed", {
      adminUserId: auth.context.user.id,
      targetUserId: enrollment.targetUserId,
      passkeyCount: passkeys.length,
    });
    response = NextResponse.json({ status: "Registered", registeredAt, passkeyCount: passkeys.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Passkey registration failed.";
    console.error("[admin-passkey] Registration verification failed", {
      adminUserId: auth.context.user.id,
      targetUserId: id,
      error: message,
    });
    response = NextResponse.json({ error: "Unable to register the selected user’s passkey.", details: message }, { status: errorStatus });
  }

  response.cookies.set(FTM_PASSKEY_ENROLLMENT_COOKIE, "", ftmPasskeyEnrollmentCookieOptions(0));
  return response;
}