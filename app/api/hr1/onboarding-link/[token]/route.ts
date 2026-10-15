import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const CATEGORIES: Record<string, { label: string; extensions: Record<string, string> }> = {
  government_id: { label: "Government ID", extensions: { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" } },
  diploma: { label: "Diploma / Certificate of Graduation", extensions: { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" } },
  academic_record: { label: "Transcript / Academic Record", extensions: { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" } },
  sss: { label: "SSS Document", extensions: { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" } },
  philhealth: { label: "PhilHealth Document", extensions: { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" } },
  pagibig: { label: "Pag-IBIG Document", extensions: { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" } },
  tin: { label: "TIN Document", extensions: { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" } },
  clearance: { label: "Clearance", extensions: { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" } },
  medical: { label: "Medical Document", extensions: { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" } },
  other_certificate: { label: "Other Requested Document", extensions: { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" } },
};

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function resolveToken(token: string) {
  if (token.length < 40 || token.length > 80) return null;
  const { data: invite, error } = await supabaseAdmin.from("hr1_onboarding_invites")
    .select("id, onboarding_id, email, expires_at, revoked_at")
    .eq("token_hash", tokenHash(token)).maybeSingle();
  if (error || !invite || invite.revoked_at || new Date(invite.expires_at).getTime() <= Date.now()) return null;
  const { data: onboarding, error: onboardingError } = await supabaseAdmin.from("hr1_onboardings")
    .select("id, applicant_id, required_documents, background_information").eq("id", invite.onboarding_id).maybeSingle();
  if (onboardingError || !onboarding) return null;
  const { data: applicant, error: applicantError } = await supabaseAdmin.from("hr1_applicants")
    .select("id, first_name, last_name, email").eq("id", onboarding.applicant_id).maybeSingle();
  if (applicantError || !applicant || applicant.email?.toLowerCase() !== invite.email.toLowerCase()) return null;
  return { invite, onboarding, applicant };
}

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const resolved = await resolveToken(token);
  if (!resolved) return NextResponse.json({ error: "This onboarding link is invalid, expired, or has been replaced. Contact HR for a new link." }, { status: 410 });

  const categories = Array.isArray(resolved.onboarding.required_documents)
    ? resolved.onboarding.required_documents.filter((category: string) => category in CATEGORIES)
    : [];
  const { data: docs } = await supabaseAdmin.from("hr1_applicant_documents")
    .select("document_type, submission_status, verification_status, verification_remarks, created_at")
    .eq("onboarding_id", resolved.onboarding.id).order("created_at", { ascending: false });
  const documents = categories.map((type: string) => ({
    type,
    label: CATEGORIES[type].label,
    latest: docs?.find((doc) => doc.document_type === type) ?? null,
  }));

  return NextResponse.json({
    applicant_name: `${resolved.applicant.first_name} ${resolved.applicant.last_name}`,
    surname: resolved.applicant.last_name,
    given_name: resolved.applicant.first_name,
    email: resolved.invite.email,
    expires_at: resolved.invite.expires_at,
    documents,
    background_information: resolved.onboarding.background_information ?? null,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const resolved = await resolveToken(token);
  if (!resolved) return NextResponse.json({ error: "This onboarding link is invalid, expired, or has been replaced. Contact HR for a new link." }, { status: 410 });

  let form: FormData;
  try { form = await request.formData(); }
  catch { return NextResponse.json({ error: "Invalid upload form." }, { status: 400 }); }

  const backgroundField = form.get("background_information");
  if (typeof backgroundField !== "string" || backgroundField.length > 10000) {
    return NextResponse.json({ error: "Complete the background investigation form before submitting." }, { status: 400 });
  }
  let backgroundInformation: Record<string, string>;
  try {
    const parsed = JSON.parse(backgroundField) as unknown;
    const allowedFields = ["surname", "given_name", "middle_name", "name_suffix", "civil_status", "gender", "birth_date", "contact_number", "sss_number", "philhealth_number", "pagibig_number", "tin_number", "current_address", "permanent_address"];
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid form fields");
    const input = parsed as Record<string, unknown>;
    if (Object.keys(input).some((key) => !allowedFields.includes(key))) throw new Error("Unexpected form fields");
    backgroundInformation = {};
    for (const key of allowedFields) {
      const value = input[key];
      if (typeof value !== "string" || !value.trim() || value.length > (key.endsWith("address") ? 2000 : 150)) {
        throw new Error("Complete every field. Enter N/A when a government number does not apply.");
      }
      backgroundInformation[key] = value.trim();
    }
    const birthDate = backgroundInformation.birth_date;
    const parsedBirthDate = new Date(`${birthDate}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || Number.isNaN(parsedBirthDate.getTime()) || parsedBirthDate.toISOString().slice(0, 10) !== birthDate || birthDate > new Date().toISOString().slice(0, 10)) {
      throw new Error("Enter a valid birth date that is not in the future.");
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Background investigation details are invalid." }, { status: 400 });
  }

  const requested = new Set<string>(Array.isArray(resolved.onboarding.required_documents) ? resolved.onboarding.required_documents : []);
  const files: { category: string; file: File; mime: string; extension: string; bytes: Buffer }[] = [];
  const { data: previousDocuments } = await supabaseAdmin.from("hr1_applicant_documents")
    .select("document_type, verification_status, created_at").eq("onboarding_id", resolved.onboarding.id)
    .order("created_at", { ascending: false });
  for (const category of Object.keys(CATEGORIES)) {
    const value = form.get(category);
    if (!(value instanceof File) || value.size === 0) continue;
    if (!requested.has(category)) return NextResponse.json({ error: "A document was uploaded for a category that HR did not request." }, { status: 400 });
    const latestForCategory = previousDocuments?.find((doc) => doc.document_type === category);
    if (latestForCategory?.verification_status === "Verified") {
      return NextResponse.json({ error: `${CATEGORIES[category].label} has already been verified. Contact HR if a replacement is needed.` }, { status: 409 });
    }
    if (value.size > MAX_FILE_BYTES) return NextResponse.json({ error: `${CATEGORIES[category].label} must be 5 MB or smaller.` }, { status: 400 });
    const extension = value.name.split(".").pop()?.toLowerCase() ?? "";
    const mime = CATEGORIES[category].extensions[extension];
    if (!mime || value.type !== mime) return NextResponse.json({ error: `${CATEGORIES[category].label} must be a PDF, JPG, or PNG.` }, { status: 400 });
    const bytes = Buffer.from(await value.arrayBuffer());
    const valid = extension === "pdf" ? bytes.subarray(0, 5).toString("ascii") === "%PDF-"
      : extension === "jpg" || extension === "jpeg" ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    if (!valid) return NextResponse.json({ error: `${CATEGORIES[category].label} does not match its file type.` }, { status: 400 });
    files.push({ category, file: value, mime, extension, bytes });
  }
  if (files.length === 0) return NextResponse.json({ error: "Choose at least one requested document to upload." }, { status: 400 });
  if (files.reduce((total, item) => total + item.file.size, 0) > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "The combined upload must be 20 MB or smaller. Submit fewer files at a time." }, { status: 413 });
  }

  const uploadedPaths: string[] = [];
  const rows: Record<string, unknown>[] = [];
  for (const item of files) {
    const path = `onboarding/${resolved.onboarding.id}/${crypto.randomUUID()}.${item.extension}`;
    const { error: uploadError } = await supabaseAdmin.storage.from("resumes").upload(path, item.bytes, { contentType: item.mime, upsert: false });
    if (uploadError) {
      if (uploadedPaths.length) await supabaseAdmin.storage.from("resumes").remove(uploadedPaths);
      console.error("HR1 onboarding file upload failed:", uploadError.message);
      return NextResponse.json({ error: "A file could not be stored securely. Please retry." }, { status: 500 });
    }
    uploadedPaths.push(path);
    rows.push({
      applicant_id: resolved.applicant.id,
      onboarding_id: resolved.onboarding.id,
      document_type: item.category,
      original_filename: item.file.name.slice(0, 255),
      storage_path: path,
      mime_type: item.mime,
      size_bytes: item.file.size,
      submission_status: "Submitted",
      verification_status: "Pending Verification",
    });
  }

  const { error: metadataError } = await supabaseAdmin.from("hr1_applicant_documents").insert(rows);
  if (metadataError) {
    await supabaseAdmin.storage.from("resumes").remove(uploadedPaths);
    console.error("HR1 onboarding metadata insert failed:", metadataError.message);
    return NextResponse.json({ error: "Files were not recorded. Please contact HR before retrying." }, { status: 500 });
  }

  const { error: backgroundUpdateError } = await supabaseAdmin.from("hr1_onboardings")
    .update({ background_information: backgroundInformation }).eq("id", resolved.onboarding.id);
  if (backgroundUpdateError) {
    await supabaseAdmin.from("hr1_applicant_documents").delete().eq("onboarding_id", resolved.onboarding.id).in("storage_path", uploadedPaths);
    await supabaseAdmin.storage.from("resumes").remove(uploadedPaths);
    console.error("HR1 onboarding background form save failed:", backgroundUpdateError.message);
    return NextResponse.json({ error: "The form details could not be saved. Please retry or contact HR." }, { status: 500 });
  }

  return NextResponse.json({ message: "Your onboarding form and documents were submitted securely. HR will review each document." }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
