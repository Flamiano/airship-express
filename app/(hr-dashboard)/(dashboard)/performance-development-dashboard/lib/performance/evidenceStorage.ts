import "server-only";

import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import {
  ALLOWED_EVIDENCE_MIME_TYPES,
  EVIDENCE_SIGNED_URL_EXPIRY_SECONDS,
  EVIDENCE_STORAGE_BUCKET,
  EVIDENCE_STORAGE_FOLDER,
  MAX_EVIDENCE_FILE_SIZE_BYTES,
} from "@/performance-development-dashboard/lib/constants";

/**
 * Server-side storage layer for Goal Evidence.
 *
 * Evidence lives in the PRIVATE `hr3` Storage bucket (never public). Files are
 * ONLY uploaded/downloaded through server-mediated APIs; the client only ever
 * receives short-lived signed URLs, never the raw object path or a public URL.
 *
 * No Storage policies are needed for this design:
 * - Uploads run with the service-role admin client (policy bypass).
 * - Downloads are signed via `createSignedUrl`, which the service role signs
 *   directly.
 */

const EVIDENCE_MIME_EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

const ALLOWED_EVIDENCE_MIME_SET = new Set<string>(ALLOWED_EVIDENCE_MIME_TYPES);

export function isAllowedEvidenceMime(mime: unknown): boolean {
  return (
    typeof mime === "string" &&
    ALLOWED_EVIDENCE_MIME_SET.has(mime.toLowerCase())
  );
}

export function evidenceMimeExtension(mime: string): string | null {
  const normalized = mime.toLowerCase();
  if (!ALLOWED_EVIDENCE_MIME_SET.has(normalized)) return null;
  return EVIDENCE_MIME_EXTENSION[normalized] ?? null;
}

export function isAllowedEvidenceFileSize(sizeBytes: number): boolean {
  return (
    Number.isInteger(sizeBytes) &&
    sizeBytes > 0 &&
    sizeBytes <= MAX_EVIDENCE_FILE_SIZE_BYTES
  );
}

/**
 * Server-authored, MIME-derived object path. The client's original file name is
 * NEVER part of the path. Format:
 *   goal-evidence/{employeeId}/{goalId}/{uuid}.{ext}
 */
export function buildEvidenceAttachmentPath(input: {
  employeeId: string;
  goalId: string;
  mime: string;
}): string | null {
  const extension = evidenceMimeExtension(input.mime);
  if (!extension) return null;
  return `${EVIDENCE_STORAGE_FOLDER}/${input.employeeId}/${input.goalId}/${randomUUID()}.${extension}`;
}

/**
 * Uploads evidence content for an already-built path using the service role
 * (policy-free). Returns the bucket-relative path on success, never the raw
 * SDK error object.
 */
export async function uploadEvidenceAttachment(input: {
  path: string;
  data: Uint8Array;
  mime: string;
}): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const { error } = await supabaseAdmin.storage
    .from(EVIDENCE_STORAGE_BUCKET)
    .upload(input.path, input.data, {
      contentType: input.mime,
      upsert: false,
    });
  if (error) {
    console.error("uploadEvidenceAttachment: upload error:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, path: input.path };
}

/**
 * Best-effort cleanup for when a later step of evidence creation fails after
 * the object was already uploaded, so the bucket never holds orphaned files.
 * Never throws; failures are logged only.
 */
export async function deleteEvidenceAttachment(path: string): Promise<boolean> {
  const { error } = await supabaseAdmin.storage
    .from(EVIDENCE_STORAGE_BUCKET)
    .remove([path]);
  if (error) {
    console.error("deleteEvidenceAttachment: remove error:", error);
    return false;
  }
  return true;
}

/**
 * Generates a short-lived signed URL for a bucket-relative path. Clients are
 * only ever handed these links (redirects/downloads), never the storage path.
 * Returns null when signing failed.
 */
export async function createEvidenceFileUrl(
  path: string
): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage
    .from(EVIDENCE_STORAGE_BUCKET)
    .createSignedUrl(path, EVIDENCE_SIGNED_URL_EXPIRY_SECONDS);
  if (error) {
    console.error("createEvidenceFileUrl: createSignedUrl error:", error);
    return null;
  }
  return data.signedUrl;
}