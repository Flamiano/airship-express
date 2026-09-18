import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";

export type AdminIdentity = {
  id: string | null;
  name: string;
  email: string | null;
};

export async function resolveAdminIdentity(
  authResult: any
): Promise<AdminIdentity> {
  const id =
    authResult?.id ??
    authResult?.admin?.id ??
    authResult?.admin_id ??
    authResult?.user?.id ??
    authResult?.sub ??
    null;

  let name =
    authResult?.full_name ??
    authResult?.name ??
    authResult?.admin?.full_name ??
    null;

  let email =
    authResult?.email ??
    authResult?.admin?.email ??
    authResult?.user?.email ??
    null;

  if (id && (!name || !email)) {
    const { data } = await supabaseAdmin
      .from("hr_admin")
      .select("full_name, email")
      .eq("id", id)
      .maybeSingle();

    name = name ?? data?.full_name ?? null;
    email = email ?? data?.email ?? null;
  }

  return {
    id,
    name: name || email || "Unknown Admin",
    email,
  };
}
