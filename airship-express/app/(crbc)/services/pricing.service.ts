import { tariffCard, type TariffCard } from "../data/tariffs";


async function getTariffCard(): Promise<TariffCard> {
  return tariffCard;
}

export type QuoteInput = {
  actualWeightKg: number;
  dimensionsCm?: { length: number; width: number; height: number };
  declaredValue?: number;
  packagingProvided: boolean;
};

export type QuoteLineItem = {
  label: string;
  explanation?: string;
  amount: number;
};

export type Quote = {
  currency: string;
  lineItems: QuoteLineItem[];
  total: number;
  volumetricWeightKg: number;
  chargeableWeightKg: number;
};

export async function getQuote(input: QuoteInput): Promise<Quote> {
  const card = await getTariffCard();

  const dims = input.dimensionsCm;
  const volumetricWeightKg =
    dims && dims.length > 0 && dims.width > 0 && dims.height > 0
      ? (dims.length * dims.width * dims.height) / card.volumetricDivisor
      : 0;

  const billableWeightKg = Math.max(input.actualWeightKg, volumetricWeightKg);
  const extraKg = Math.max(0, Math.ceil(billableWeightKg) - card.includedWeightKg);

  const lineItems: QuoteLineItem[] = [
    {
      label: "Base fare",
      explanation: `Includes first ${card.includedWeightKg} kg`,
      amount: card.baseFare,
    },
  ];

  if (extraKg > 0) {
    lineItems.push({
      label: `Additional weight (${extraKg} kg)`,
      explanation: `${card.perKgFee} per kg above ${card.includedWeightKg} kg`,
      amount: extraKg * card.perKgFee,
    });
  }

  const dv = input.declaredValue ?? 0;
  if (dv > 0) {
    const valuationFee = Math.max(dv * card.valuation.ratePct, card.valuation.minimumFee);
    lineItems.push({
      label: "Valuation fee",
      explanation: `${card.valuation.ratePct * 100}% of declared value`,
      amount: valuationFee,
    });
  }

  if (input.packagingProvided) {
    lineItems.push({
      label: "Packaging service",
      amount: card.packaging.providedFee,
    });
  }

  const total = lineItems.reduce((sum, li) => sum + li.amount, 0);

  return {
    currency: card.currency,
    lineItems,
    total,
    volumetricWeightKg,
    chargeableWeightKg: billableWeightKg,
  };
}
