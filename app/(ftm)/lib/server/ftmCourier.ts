import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const AIRSHIP_COURIER_NAME = "Airship Express";

type CourierRecord = { id: string; name: string; code?: string | null };

export function isAirshipCourier(value: unknown) {
  return /airship/i.test(String(value || ""));
}

export async function getAirshipCouriers(supabase: SupabaseClient): Promise<CourierRecord[]> {
  const { data, error } = await supabase.from("couriers").select("id, name, code").eq("is_active", true);
  if (error) throw new Error(`Unable to resolve Airship Express courier: ${error.message}`);
  return (data || [])
    .filter((courier) => isAirshipCourier(courier.name) || isAirshipCourier(courier.code))
    .map((courier) => ({ id: String(courier.id), name: String(courier.name || AIRSHIP_COURIER_NAME), code: courier.code }));
}

export function belongsToAirshipCourier(resource: Record<string, unknown>, courierIds: Set<string>) {
  const courierId = String(resource.courier_id || resource.courierId || "");
  const courierName = resource.courier || resource.courier_name || resource.courierName || resource.courier_code;
  return (courierId && courierIds.has(courierId)) || isAirshipCourier(courierName);
}