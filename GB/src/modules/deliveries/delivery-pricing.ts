import type { DeliveryPricing, DeliveryStatus } from './types/delivery.types';

const METERS_PER_UNIT = { KM: 1000, M: 1 } as const;
const EPSILON = 1e-9;

/**
 * The fee shown while planning a delivery. The same formula as the API's
 * (GB-BE deliveries/domain/delivery-pricing.ts), which is what is charged:
 * base + units × price, at least the minimum, rounded up to the step.
 */
export function quoteDelivery(distanceMeters: number, pricing: DeliveryPricing): { units: number; fee: number } {
  const exactUnits = Math.max(distanceMeters, 0) / (pricing.unitSize * METERS_PER_UNIT[pricing.unit]);
  const units = pricing.billingMode === 'FULL_UNITS' ? Math.ceil(exactUnits - EPSILON) : exactUnits;
  let fee = Math.max(pricing.baseFee + units * pricing.pricePerUnit, pricing.minimumFee);
  if (pricing.roundingStep > 0) {
    fee = Math.ceil(fee / pricing.roundingStep - EPSILON) * pricing.roundingStep;
  }
  return { units: Math.round(units * 1000) / 1000, fee: Math.round(fee * 100) / 100 };
}

/** "3,4 km" or "850 m". */
export function formatDistance(meters: number): string {
  return meters >= 1000
    ? `${(meters / 1000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} km`
    : `${Math.round(meters)} m`;
}

/** "12 min" or "1 h 05 min". */
export function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}

/** "$1.000 por km", "$600 por cada 500 m". */
export function describeUnit(pricing: Pick<DeliveryPricing, 'unit' | 'unitSize'>): string {
  const label = pricing.unit === 'KM' ? 'km' : 'm';
  return pricing.unitSize === 1 ? `por ${label}` : `por cada ${pricing.unitSize.toLocaleString('es-CO')} ${label}`;
}

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  PENDING: 'Sin asignar',
  ASSIGNED: 'Asignado',
  IN_TRANSIT: 'En camino',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
};

export const DELIVERY_STATUS_TONES: Record<DeliveryStatus, 'neutral' | 'info' | 'warning' | 'success' | 'error'> = {
  PENDING: 'warning',
  ASSIGNED: 'info',
  IN_TRANSIT: 'info',
  DELIVERED: 'success',
  CANCELLED: 'neutral',
};
