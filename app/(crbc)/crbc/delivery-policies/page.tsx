import { createClient } from "../../library/supabase/server";
import { mapDeliveryPolicyRow } from "../../types/delivery-policy";
import DeliveryPolicyClient from "../../components/DeliveryPolicyClient";

export default async function DeliveryPoliciesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("delivery_policies")
    .select("*")
    .order("created_at", { ascending: true });

  const policies = data?.map(mapDeliveryPolicyRow) ?? [];

  return <DeliveryPolicyClient Policies={policies} />;
}
