export const DISCOUNT_KINDS = ['PROMOTION', 'COUPON'] as const;
export type DiscountKind = (typeof DISCOUNT_KINDS)[number];

/** Where an order's discount came from. */
export const DISCOUNT_SOURCES = ['MANUAL', 'PROMOTION', 'COUPON'] as const;
export type DiscountSource = (typeof DISCOUNT_SOURCES)[number];

export interface DiscountRow {
  id: string;
  business_id: string;
  kind: DiscountKind;
  name: string;
  description: string | null;
  code: string | null;
  percent: string;
  starts_at: Date | null;
  ends_at: Date | null;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Discount {
  id: string;
  kind: DiscountKind;
  name: string;
  description: string | null;
  code: string | null;
  percent: number;
  startsAt: Date | null;
  endsAt: Date | null;
  maxUses: number | null;
  usedCount: number;
  isActive: boolean;
  /** Whether it can be applied right now (active, within its dates, uses left). */
  usableNow: boolean;
  createdAt: Date;
}

export interface DiscountInput {
  kind: DiscountKind;
  name: string;
  description?: string | null;
  code?: string | null;
  percent: number;
  startsAt?: Date | null;
  endsAt?: Date | null;
  maxUses?: number | null;
  isActive?: boolean;
}

/** The discount an order gets at checkout. */
export interface AppliedDiscount {
  source: DiscountSource;
  percent: number;
  discountId: string | null;
  /** How it reads on the order and the receipt: "Cupón VERANO10 (10%)". */
  label: string;
}

/** Why a promotion or coupon cannot be used now; null when it can. */
export function unusableReason(row: DiscountRow, now: Date): string | null {
  if (!row.is_active) return 'está desactivado';
  if (row.starts_at && now < row.starts_at) return 'todavía no está vigente';
  if (row.ends_at && now > row.ends_at) return 'ya venció';
  if (row.max_uses !== null && row.used_count >= row.max_uses)
    return 'ya alcanzó su límite de usos';
  return null;
}

/** "5" or "12,5". */
export function formatPercent(percent: number): string {
  return Number.isInteger(percent)
    ? String(percent)
    : percent.toFixed(2).replace(/0+$/, '').replace('.', ',');
}

/** The amount a percentage takes off a subtotal (before tax and delivery). */
export function discountAmountFor(subtotal: number, percent: number): number {
  return Math.round(Math.max(subtotal, 0) * percent) / 100;
}
