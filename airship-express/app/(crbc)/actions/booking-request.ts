"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "../library/supabase/server";

export async function cancelBookingRequest(
  requestId: string
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return { error: "Unauthorized" };

  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("id", user.id)
    .single();

  if (!customer) return { error: "Customer profile not found." };

  const { data: existing } = await supabase
    .from("booking_requests")
    .select("id, status, customer_id")
    .eq("request_id", requestId)
    .single();

  if (!existing) return { error: "Booking request not found." };
  if (existing.customer_id !== customer.id) return { error: "Forbidden." };
  if (existing.status !== "PENDING") return { error: "Only pending requests can be cancelled." };

  const { error } = await supabase
    .from("booking_requests")
    .update({ status: "CANCELLED" })
    .eq("id", existing.id);

  if (error) return { error: "Failed to cancel. Please try again." };

  revalidatePath("/customer/shipments");
  return { success: true };
}
