import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("hr_access_token")?.value;

  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify the token with Supabase
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (error || !user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  // Get the user's full info from hr_admin table
  const { data: adminData, error: dbError } = await supabaseAdmin
    .from("hr_admin")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  if (dbError || !adminData) {
    return NextResponse.json(
      { error: "User profile not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    fullName: adminData.full_name,
    role: adminData.role,
  });
}
