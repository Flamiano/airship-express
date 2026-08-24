import { createClient } from "../supabase/server";
import type { User } from "@supabase/supabase-js";
import type { Customers } from "../../types/customer";

export type CurrentUser = {
  authUser: User;
  customer: Customers;
} | null;

export async function getCurrentUser(): Promise<CurrentUser | null>  {
  const supabase = await createClient();

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser) {
    return null;
  }

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("*")
    .eq("id", authUser.id)
    .single();

  if (customerError || !customer) {
    return null;
  }

  return {
    authUser,
    customer,
  };
}
