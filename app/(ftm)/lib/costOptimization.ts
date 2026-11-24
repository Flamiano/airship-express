export type VehicleCostPerKm = {
  id: string;
  name: string;
  costPerKm: number | null;
};

export type CostOptimizationOpportunity = VehicleCostPerKm & {
  fleetMedianCostPerKm: number;
  differencePerKm: number;
  percentAboveMedian: number;
};

export function getCostOptimizationOpportunities(
  vehicles: readonly VehicleCostPerKm[],
  limit = 3,
): CostOptimizationOpportunity[] {
  const comparable = vehicles.filter((vehicle): vehicle is VehicleCostPerKm & { costPerKm: number } =>
    Boolean(vehicle.id)
    && vehicle.costPerKm != null
    && Number.isFinite(vehicle.costPerKm)
    && vehicle.costPerKm > 0,
  );
  if (comparable.length < 2 || !Number.isInteger(limit) || limit < 1) return [];

  const sortedCosts = comparable.map((vehicle) => vehicle.costPerKm).sort((a, b) => a - b);
  const middle = Math.floor(sortedCosts.length / 2);
  const fleetMedianCostPerKm = sortedCosts.length % 2
    ? sortedCosts[middle]
    : (sortedCosts[middle - 1] + sortedCosts[middle]) / 2;

  if (fleetMedianCostPerKm <= 0) return [];

  return comparable
    .filter((vehicle) => vehicle.costPerKm > fleetMedianCostPerKm)
    .sort((left, right) => right.costPerKm - left.costPerKm)
    .slice(0, limit)
    .map((vehicle) => ({
      ...vehicle,
      fleetMedianCostPerKm,
      differencePerKm: vehicle.costPerKm - fleetMedianCostPerKm,
      percentAboveMedian: ((vehicle.costPerKm - fleetMedianCostPerKm) / fleetMedianCostPerKm) * 100,
    }));
}
