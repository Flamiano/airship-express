import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";

export const dynamic = "force-dynamic";

const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = new Map([
  [".pdf", "application/pdf"],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
]);
function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid application form data." }, { status: 400 });
  }

  const field = (name: string) => String(form.get(name) ?? "").trim();
  const positionId = field("job_position_id");
  const firstName = field("first_name");
  const lastName = field("last_name");
  const email = field("email").toLowerCase();
  const phone = field("phone");
  const address = field("address");
  const emergencyName = field("emergency_contact_name");
  const emergencyPhone = field("emergency_contact_phone");
  const file = form.get("resume");

  if (form.has("supporting_document") || form.has("supporting_document_type")) {
    return NextResponse.json({ error: "Government and education documents are collected through the secure onboarding link after recruitment." }, { status: 400 });
  }

  if (!isUuid(positionId) || !firstName || !lastName || !phone || !file || !(file instanceof File)) {
    return NextResponse.json({ error: "Complete the required fields and attach a resume." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (file.size < 1 || file.size > MAX_RESUME_BYTES) {
    return NextResponse.json({ error: "Resume must be between 1 byte and 5 MB." }, { status: 400 });
  }

  const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
  const expectedType = ACCEPTED_TYPES.get(extension);
  const bytes = Buffer.from(await file.arrayBuffer());
  const validSignature = extension === ".pdf"
    ? bytes.subarray(0, 5).toString("ascii") === "%PDF-"
    : extension === ".docx"
      ? bytes[0] === 0x50 && bytes[1] === 0x4b
      : false;
  if (!expectedType || file.type !== expectedType || !validSignature) {
    return NextResponse.json({ error: "Upload a valid PDF or DOCX resume." }, { status: 400 });
  }

  // The server rechecks publication state; callers cannot apply to a draft,
  // closed, legacy, or unapproved job by sending its ID directly.
  const { data: position, error: positionError } = await supabaseAdmin
    .from("hr1_job_positions")
    .select("id, title, is_active, posting_status, manpower_request_id")
    .eq("id", positionId)
    .maybeSingle();
  if (positionError || !position || !position.is_active || position.posting_status !== "Published" || !position.manpower_request_id) {
    return NextResponse.json({ error: "This vacancy is not accepting applications." }, { status: 409 });
  }
  const { data: sourceRequest, error: requestError } = await supabaseAdmin
    .from("hr1_manpower_requests")
    .select("id, status")
    .eq("id", position.manpower_request_id)
    .maybeSingle();
  if (requestError || sourceRequest?.status !== "Approved") {
    return NextResponse.json({ error: "This vacancy is not accepting applications." }, { status: 409 });
  }

  // Keep the existing PDF/DOCX text extraction workflow, but send the file
  // through the server so resume text and private storage use the same upload.
  const extractionForm = new FormData();
  extractionForm.set("file", file);
  const extractionResponse = await fetch(new URL("/api/resume-extract", request.url), {
    method: "POST",
    body: extractionForm,
    cache: "no-store",
  });
  const extraction = await extractionResponse.json().catch(() => null);
  if (!extractionResponse.ok || typeof extraction?.text !== "string") {
    return NextResponse.json({ error: extraction?.error ?? "Could not read text from this resume." }, { status: 400 });
  }

  const storagePath = `applicants/${crypto.randomUUID()}${extension}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from("resumes")
    .upload(storagePath, bytes, { contentType: expectedType, upsert: false });
  if (uploadError) {
    console.error("HR1 private resume upload failed:", uploadError.message);
    return NextResponse.json({ error: "Resume upload failed. Please try again." }, { status: 500 });
  }
  const uploadedPaths = [storagePath];

  const { data: applicant, error: applicantError } = await supabaseAdmin
    .from("hr1_applicants")
    .insert({
      job_position_id: positionId,
      first_name: firstName.slice(0, 100),
      last_name: lastName.slice(0, 100),
      email,
      phone: phone.slice(0, 50),
      address: address ? address.slice(0, 1000) : null,
      emergency_contact_name: emergencyName ? emergencyName.slice(0, 150) : null,
      emergency_contact_phone: emergencyPhone ? emergencyPhone.slice(0, 50) : null,
      resume_url: storagePath,
      resume_text: extraction.text.slice(0, 50000),
    })
    .select("id, application_reference")
    .single();

  if (applicantError || !applicant) {
    await supabaseAdmin.storage.from("resumes").remove(uploadedPaths);
    console.error("HR1 public application save failed:", applicantError?.message);
    return NextResponse.json({ error: "Unable to submit your application right now." }, { status: 500 });
  }

  const { error: documentError } = await supabaseAdmin
    .from("hr1_applicant_documents")
    .insert([
      {
        applicant_id: applicant.id,
        document_type: "resume",
        original_filename: file.name.slice(0, 255),
        storage_path: storagePath,
        mime_type: expectedType,
        size_bytes: file.size,
        submission_status: "Submitted",
        verification_status: "Pending Verification",
      },
    ]);

  if (documentError) {
    await supabaseAdmin.from("hr1_applicants").delete().eq("id", applicant.id);
    await supabaseAdmin.storage.from("resumes").remove(uploadedPaths);
    console.error("HR1 applicant document metadata save failed:", documentError.message);
    return NextResponse.json({ error: "Unable to submit your application right now." }, { status: 500 });
  }

  return NextResponse.json({ application_reference: applicant.application_reference }, { status: 201 });
}
