

export type TariffCard = {
  /** Human-readable name of the rate card, e.g. "Metro Manila ground" */
  name: string;
  currency: "PHP";
  /** Flat fare covering the first includedWeightKg kilograms */
  baseFare: number;
  includedWeightKg: number;
  /** Per-kg charge applied to each kg above includedWeightKg (rounded up) */
  perKgFee: number;
  valuation: {
    /** Percentage of declared value, e.g. 0.01 = 1% */
    ratePct: number;
    minimumFee: number;
  };
  packaging: {
    /** Fee when Airship provides packaging materials */
    providedFee: number;
  };
  /**
   * Divisor for volumetric weight in cm³/kg.
   * Industry standard for ground courier is 5000.
   */
  volumetricDivisor: number;
};

export const tariffCard: TariffCard = {
  name: "Airship Standard",
  currency: "PHP",
  baseFare: 95,
  includedWeightKg: 1,
  perKgFee: 30,
  valuation: { ratePct: 0.01, minimumFee: 10 },
  packaging: { providedFee: 25 },
  volumetricDivisor: 5000,
};
