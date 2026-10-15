import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/app/(hr-dashboard)/supabase/server";
import { resolveHrAccountForSession } from "@/app/(hr-dashboard)/lib/hr-account";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";

export const dynamic = "force-dynamic";
const HR_ROLES = new Set(["super_admin", "hr_recruitment_admin"]);

function getResumePath(value: string): string | null {
  let path = value.trim();
  if (!path) return null;

  if (/^https?:\/\//i.test(path)) {
    try {
      const pathname = new URL(path).pathname;
      const markers = ["/storage/v1/object/public/resumes/", "/storage/v1/object/sign/resumes/"];
      const marker = markers.find((candidate) => pathname.includes(candidate));
      if (!marker) return null;
      path = pathname.slice(pathname.indexOf(marker) + marker.length);
      path = decodeURIComponent(path);
    } catch {
      return null;
    }
  }

  path = path.replace(/^\/+/, "");
  if ((!path.startsWith("applicants/") && !path.startsWith("onboarding/")) || path.includes("..") || path.includes("\\")) return null;
  return path;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const sessionClient = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await sessionClient.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const account = await resolveHrAccountForSession(user.id);
  if (!account || account.accountType !== "hr_admin" || !HR_ROLES.has(account.role)) {
    return NextResponse.json({ error: "HR Recruitment Admin access required." }, { status: 403 });
  }

  const { id } = await context.params;
  const documentId = new URL(request.url).searchParams.get("document");
  let savedPath = "";
  if (documentId) {
    const { data: document, error } = await supabaseAdmin
      .from("hr1_applicant_documents")
      .select("storage_path")
      .eq("id", documentId)
      .eq("applicant_id", id)
      .maybeSingle();
    if (error || !document) return NextResponse.json({ error: "Applicant document not found." }, { status: 404 });
    savedPath = document.storage_path;
  } else {
    const { data: applicant, error } = await supabaseAdmin
      .from("hr1_applicants")
      .select("resume_url")
      .eq("id", id)
      .maybeSingle();
    if (error || !applicant) return NextResponse.json({ error: "Applicant or resume not found." }, { status: 404 });
    savedPath = applicant.resume_url ?? "";
  }

  const path = getResumePath(savedPath);
  if (!path) return NextResponse.json({ error: "This applicant has no supported stored resume." }, { status: 404 });

  const download = new URL(request.url).searchParams.get("download") === "1";
  const filename = path.split("/").at(-1) || "resume";
  const { data, error: signingError } = await supabaseAdmin.storage
    .from("resumes")
    .createSignedUrl(path, 60, { download: download ? filename : false });
  if (signingError || !data?.signedUrl) {
    console.error("HR1 resume signed URL creation failed:", signingError?.message);
    return NextResponse.json({ error: "The stored resume is unavailable." }, { status: 404 });
  }

  return NextResponse.redirect(data.signedUrl, {
    status: 302,
    headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
  });
}
