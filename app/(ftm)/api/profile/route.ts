import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authenticateFtmRequest } from "../../lib/server/ftmRequestAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET_NAME = "ftm-avatars";
const MAX_AVATAR_BYTES = 700 * 1024;
const IMAGE_TYPES = {
  jpeg: { extension: "jpg", contentType: "image/jpeg" },
  jpg: { extension: "jpg", contentType: "image/jpeg" },
  png: { extension: "png", contentType: "image/png" },
  webp: { extension: "webp", contentType: "image/webp" },
} as const;

type ImageType = keyof typeof IMAGE_TYPES;

function isImageFile(file: Buffer, type: ImageType) {
  if (type === "jpeg" || type === "jpg") return file.length > 3 && file[0] === 0xff && file[1] === 0xd8 && file[2] === 0xff;
  if (type === "png") return file.length > 8 && file.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return file.length > 12 && file.subarray(0, 4).toString() === "RIFF" && file.subarray(8, 12).toString() === "WEBP";
}

async function ensureAvatarBucket(supabase: SupabaseClient) {
  const { data: bucket, error: lookupError } = await supabase.storage.getBucket(BUCKET_NAME);
  if (!lookupError && bucket) return;
  const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
    public: true,
    fileSizeLimit: String(MAX_AVATAR_BYTES),
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  });
  if (error && !/already exists|duplicate/i.test(error.message || "")) throw error;
}

function getPublicAvatarUrl(supabase: SupabaseClient, path: string) {
  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
  return data?.publicUrl ? `${data.publicUrl}?v=${Date.now()}` : null;
}

function parseImage(content: string) {
  const match = /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/.exec(content);
  if (!match) return null;
  const type = match[1] as ImageType;
  const file = Buffer.from(match[2], "base64");
  if (!file.length || file.length > MAX_AVATAR_BYTES || !isImageFile(file, type)) return null;
  return { type, file, image: IMAGE_TYPES[type] };
}

export async function GET(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const { user, profile, serviceClient } = auth.context;
  const { data: account } = await serviceClient.from("users").select("*").eq("id", user.id).maybeSingle();

  let avatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url || null;
  if (typeof avatarUrl === "string" && avatarUrl.startsWith("data:image/")) {
    const parsed = parseImage(avatarUrl);
    if (parsed) {
      try {
        await ensureAvatarBucket(serviceClient);
        const path = `${user.id}/avatar.${parsed.image.extension}`;
        const { error } = await serviceClient.storage.from(BUCKET_NAME).upload(path, parsed.file, {
          contentType: parsed.image.contentType,
          upsert: true,
        });
        if (!error) {
          avatarUrl = getPublicAvatarUrl(serviceClient, path);
          await serviceClient.from("users").update({ avatar_url: avatarUrl }).eq("id", user.id);
        }
      } catch {
        avatarUrl = null;
      }
    } else {
      avatarUrl = null;
    }
  }

  return NextResponse.json({
    id: user.id,
    email: user.email || profile?.email || null,
    full_name: user.user_metadata?.full_name || profile?.full_name || null,
    avatar_url: avatarUrl,
    role: user.role,
    phone: account?.phone || user.user_metadata?.phone || null,
    username: account?.username || user.user_metadata?.username || null,
    employee_id: account?.employee_id_number || account?.employee_id || null,
    department: account?.department || null,
    license_number: account?.license_number || account?.driver_license_number || null,
    license_expiry: account?.license_expiry || account?.license_expiration || null,
    courier_id: account?.courier_id || null,
    is_active: account?.is_active !== false,
    created_at: account?.created_at || user.created_at || null,
    last_sign_in_at: user.last_sign_in_at || null,
    updated_at: account?.updated_at || null,
  });
}

export async function PATCH(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const { user, serviceClient } = auth.context;
  let body: { full_name?: unknown; phone?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.full_name !== undefined) {
    const fullName = String(body.full_name).trim();
    if (fullName.length < 2 || fullName.length > 120) return NextResponse.json({ error: "Full name must be between 2 and 120 characters." }, { status: 400 });
    updates.full_name = fullName;
  }
  if (body.phone !== undefined) {
    const phone = String(body.phone).trim();
    if (phone.length > 40) return NextResponse.json({ error: "Contact number must be 40 characters or fewer." }, { status: 400 });
    updates.phone = phone || null;
  }
  if (Object.keys(updates).length === 1) return NextResponse.json({ error: "No profile fields were provided." }, { status: 400 });

  const { data, error } = await serviceClient.from("users").update(updates).eq("id", user.id).select("id, full_name, phone, updated_at").maybeSingle();
  if (error) return NextResponse.json({ error: `Unable to save profile details: ${error.message}` }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Profile record not found." }, { status: 404 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const { user, serviceClient } = auth.context;

  let body: { content?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }

  const content = String(body.content || "");
  const parsed = parseImage(content);
  if (!parsed) {
    const hasSupportedType = /^data:image\/(jpeg|jpg|png|webp);base64,/.test(content);
    return NextResponse.json({
      error: hasSupportedType ? "The uploaded file is too large or does not match its image format" : "A supported image is required",
    }, { status: hasSupportedType ? 413 : 400 });
  }

  try {
    await ensureAvatarBucket(serviceClient);
  } catch (error) {
    return NextResponse.json({ error: `Unable to initialize avatar storage: ${error instanceof Error ? error.message : String(error)}` }, { status: 503 });
  }

  const path = `${user.id}/avatar.${parsed.image.extension}`;
  const { error: uploadError } = await serviceClient.storage.from(BUCKET_NAME).upload(path, parsed.file, {
    contentType: parsed.image.contentType,
    upsert: true,
  });
  if (uploadError) return NextResponse.json({ error: uploadError.message || "Unable to upload avatar" }, { status: 500 });

  const avatarUrl = getPublicAvatarUrl(serviceClient, path);
  if (!avatarUrl) return NextResponse.json({ error: "Unable to create an avatar URL" }, { status: 500 });
  const { error: profileError } = await serviceClient.from("users").update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() }).eq("id", user.id);
  if (profileError) return NextResponse.json({ error: profileError.message || "Unable to save avatar profile data" }, { status: 500 });
  const { error: authError } = await serviceClient.auth.admin.updateUserById(user.id, { user_metadata: { avatar_url: avatarUrl } });
  if (authError) console.warn("Avatar saved to profile but not Auth metadata:", authError.message);
  await serviceClient.storage.from(BUCKET_NAME).remove([`${user.id}/avatar.png`, `${user.id}/avatar.webp`]);

  return NextResponse.json({ avatar_url: avatarUrl });
}

export async function DELETE(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const { user, serviceClient } = auth.context;

  const { error: profileError } = await serviceClient.from("users").update({ avatar_url: null, updated_at: new Date().toISOString() }).eq("id", user.id);
  if (profileError) return NextResponse.json({ error: profileError.message || "Unable to remove avatar" }, { status: 500 });
  const { error } = await serviceClient.auth.admin.updateUserById(user.id, { user_metadata: { avatar_url: null } });
  if (error) console.warn("Avatar removed from profile but not Auth metadata:", error.message);
  await serviceClient.storage.from(BUCKET_NAME).remove([`${user.id}/avatar.jpg`, `${user.id}/avatar.png`, `${user.id}/avatar.webp`]);
  return NextResponse.json({ avatar_url: null });
}