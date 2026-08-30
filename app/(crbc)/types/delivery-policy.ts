export type DeliveryPolicy = {
  id: string;
  policy: string;
  coverage: string;
  minDays: number;
  maxDays: number;
  createdAt: string;
  updatedAt: string;
};

export type DeliveryPolicyRow = {
  id: string;
  policy: string;
  coverage: string;
  min_days: number;
  max_days: number;
  created_at: string;
  updated_at: string;
};

export function mapDeliveryPolicyRow(row: DeliveryPolicyRow): DeliveryPolicy {
  return {
    id: row.id,
    policy: row.policy,
    coverage: row.coverage,
    minDays: row.min_days,
    maxDays: row.max_days,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}