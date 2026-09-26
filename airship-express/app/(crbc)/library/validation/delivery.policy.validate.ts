import { SupabaseClient } from "@supabase/supabase-js";


type DeliveryPolicyInput = {
  policy: string;
  coverage: string;
  minDays: number;
  maxDays: number;
};

export function validatePolicyInput(data: DeliveryPolicyInput) {
  const { policy, coverage, minDays, maxDays } = data;

  if (!policy || typeof policy !== "string") {
    return "Policy name is required.";
  }

  if (!coverage || typeof coverage !== "string") {
    return "Coverage is required.";
  }

  if (!Number.isFinite(minDays) || !Number.isFinite(maxDays)) {
    return "Min and max days must be numbers.";
  }

  if (minDays < 1 || maxDays < 1) {
    return "Days must be at least 1.";
  }

  if (minDays > maxDays) {
    return "Min day can't be greater than max day.";
  }

  return null;
}

export function validateId(id: unknown) {
  if (!id || typeof id !== "string") {
    return "ID is required.";
  }

  return null;
}

export async function getAuthenticatedClient(createClient: () => Promise<SupabaseClient>) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return supabase;
}
