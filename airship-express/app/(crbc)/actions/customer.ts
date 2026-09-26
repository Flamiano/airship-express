"use server";

import { createClient } from "@/app/(crbc)/library/supabase/server";
import type { PackageType } from "../types/booking-request";

export type BookingPackageDetails = {
  package_quantity: number;
  package_type: PackageType;
  item_category: string;
  weight: number;
  dimensions?: {
    length_cm: number;
    width_cm: number;
    height_cm: number;
  };
  declared_value?: number;
  packaging_service: "empty" | "provided";
  remarks?: string;
};

export type UpdateCustomerFormState = {
  id: string;
  full_name: string;
  phone: string | null;
  address: string | null;
  email: string | null;
};

export type UpdateCustomerResult = {
  success?: boolean;
  error?: string;
};

export async function updateCustomer(
  prevState: UpdateCustomerFormState,
  formData: FormData
): Promise<UpdateCustomerResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized" };
  }

  // Extract form data
  const id = formData.get("id") as string;
  const full_name = formData.get("full_name") as string;
  const phone = formData.get("phone") as string | null;
  const address = formData.get("address") as string | null;
  const email = formData.get("email") as string | null;

  // Validate
  if (!id || !full_name) {
    return { error: "ID and full name are required" };
  }

  // Update the customer record
    const { data, error } = await supabase
      .from("customers")
      .update({
        full_name: full_name.trim(),
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        email: email?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select();

    if (error) {
      console.error("Customer update error:", error);
      return { error: "Failed to update customer" };
    }

    if (!data || data.length === 0) {
      return { error: "No customer record was updated — check permissions" };
    }

    return { success: true };
}