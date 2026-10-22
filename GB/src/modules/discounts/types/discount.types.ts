export type DiscountKind = 'PROMOTION' | 'COUPON';

/** Una promoción (para eventos y temporadas, se elige de una lista al cobrar) o un cupón (se aplica con su código). */
export interface Discount {
  id: string;
  kind: DiscountKind;
  name: string;
  description: string | null;
  /** Solo cupones. */
  code: string | null;
  percent: number;
  startsAt: string | null;
  endsAt: string | null;
  /** Vacío: sin límite. */
  maxUses: number | null;
  usedCount: number;
  isActive: boolean;
  /** Si se puede aplicar ahora (activo, en sus fechas y con usos disponibles). */
  usableNow: boolean;
  createdAt: string;
}

export interface DiscountPayload {
  kind: DiscountKind;
  name: string;
  description?: string | null;
  code?: string | null;
  percent: number;
  startsAt?: string | null;
  endsAt?: string | null;
  maxUses?: number | null;
  isActive?: boolean;
}

/** Lo que se elige al cobrar; NONE quita el descuento. */
export type ApplyDiscountPayload =
  | { source: 'NONE' }
  | { source: 'MANUAL'; percent: number }
  | { source: 'PROMOTION'; discountId: string }
  | { source: 'COUPON'; code: string };
