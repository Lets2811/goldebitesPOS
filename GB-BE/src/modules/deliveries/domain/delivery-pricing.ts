export const DISTANCE_UNITS = ['KM', 'M'] as const;
export type DistanceUnit = (typeof DISTANCE_UNITS)[number];

export const BILLING_MODES = ['PROPORTIONAL', 'FULL_UNITS'] as const;
export type BillingMode = (typeof BILLING_MODES)[number];

/** How a business prices its deliveries (see delivery_settings). */
export interface DeliveryPricing {
  baseFee: number;
  pricePerUnit: number;
  unit: DistanceUnit;
  /** How much distance one unit is, in `unit`: 1 km, 500 m... */
  unitSize: number;
  billingMode: BillingMode;
  minimumFee: number;
  /** The fee is rounded up to a multiple of this; 0 leaves it as is. */
  roundingStep: number;
}

export interface DeliveryQuote {
  /** Units of distance charged (fractional when PROPORTIONAL). */
  units: number;
  fee: number;
}

const METERS_PER_UNIT: Record<DistanceUnit, number> = { KM: 1000, M: 1 };
// Floating-point slack, so 3.0000000001 units is not charged as 4.
const EPSILON = 1e-9;

const roundMoney = (value: number) => Math.round(value * 100) / 100;

/**
 * The price of a delivery of `distanceMeters` by road: base + units × price,
 * at least the minimum, rounded up to the rounding step. With FULL_UNITS every
 * unit started is charged whole (2.1 km at "per 1 km" is 3 units).
 */
export function quoteDelivery(
  distanceMeters: number,
  pricing: DeliveryPricing,
): DeliveryQuote {
  const unitMeters = pricing.unitSize * METERS_PER_UNIT[pricing.unit];
  const exactUnits = Math.max(distanceMeters, 0) / unitMeters;
  const units =
    pricing.billingMode === 'FULL_UNITS'
      ? Math.ceil(exactUnits - EPSILON)
      : exactUnits;

  let fee = pricing.baseFee + units * pricing.pricePerUnit;
  fee = Math.max(fee, pricing.minimumFee);
  if (pricing.roundingStep > 0) {
    fee =
      Math.ceil(fee / pricing.roundingStep - EPSILON) * pricing.roundingStep;
  }
  return { units: Math.round(units * 1000) / 1000, fee: roundMoney(fee) };
}
