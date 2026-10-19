import { DeliveryPricing, quoteDelivery } from './delivery-pricing';

describe('quoteDelivery', () => {
  const perKm: DeliveryPricing = {
    baseFee: 0,
    pricePerUnit: 1000,
    unit: 'KM',
    unitSize: 1,
    billingMode: 'PROPORTIONAL',
    minimumFee: 0,
    roundingStep: 0,
  };

  it('charges only by distance when there is no base fee', () => {
    expect(quoteDelivery(3400, perKm)).toEqual({ units: 3.4, fee: 3400 });
  });

  it('adds the base fee', () => {
    expect(quoteDelivery(2000, { ...perKm, baseFee: 3000 }).fee).toBe(5000);
  });

  it('charges every started unit in FULL_UNITS mode', () => {
    const quote = quoteDelivery(2100, { ...perKm, billingMode: 'FULL_UNITS' });
    expect(quote).toEqual({ units: 3, fee: 3000 });
  });

  it('does not charge an extra unit for an exact distance', () => {
    const quote = quoteDelivery(3000, { ...perKm, billingMode: 'FULL_UNITS' });
    expect(quote.units).toBe(3);
  });

  it('prices per 500 m', () => {
    const quote = quoteDelivery(1250, {
      ...perKm,
      unit: 'M',
      unitSize: 500,
      pricePerUnit: 600,
      billingMode: 'FULL_UNITS',
    });
    expect(quote).toEqual({ units: 3, fee: 1800 });
  });

  it('never goes below the minimum', () => {
    expect(quoteDelivery(300, { ...perKm, minimumFee: 4000 }).fee).toBe(4000);
  });

  it('rounds up to the rounding step', () => {
    expect(quoteDelivery(3420, { ...perKm, roundingStep: 100 }).fee).toBe(3500);
    expect(quoteDelivery(3400, { ...perKm, roundingStep: 100 }).fee).toBe(3400);
  });

  it('charges just the base for a zero distance', () => {
    expect(quoteDelivery(0, { ...perKm, baseFee: 2500 }).fee).toBe(2500);
  });
});
