export function parseMeasuredFuelLiters(value: unknown) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const liters = Number(value);
  if (!Number.isFinite(liters) || liters <= 0 || liters >= 1_000_000_000) return null;
  const roundedLiters = Math.round((liters + Number.EPSILON) * 1000) / 1000;
  return roundedLiters > 0 ? roundedLiters : null;
}
