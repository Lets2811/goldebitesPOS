import type { Session } from '../auth.js';
import { ToolRefusedError } from './types.js';

/** An inventory item as GET /assistant/inventory returns it (see AssistantInventoryItem in GB-BE). */
export interface PosInventoryItem {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  isActive: boolean;
  minimumStock: number;
  currentStock: number;
  belowMinimum: boolean;
  branchId: string;
}

/** A product as GET /products/:id returns it, the part the tools need. */
export interface PosProduct {
  id: string;
  name: string;
  salePrice: number;
  isActive: boolean;
  isVisible: boolean;
  branchId?: string;
}

/** "3,5 kg", "12 botellas": a quantity with its unit, as people say it. */
export function quantity(value: number, unit: string): string {
  const rounded = Math.round(value * 1000) / 1000;
  return `${rounded.toLocaleString('es-CO')} ${unit}`;
}

/** "6.000 pesos". */
export function pesos(value: number): string {
  return `${Math.round(value).toLocaleString('es-CO')} pesos`;
}

export async function readItem(session: Session, id: string): Promise<PosInventoryItem> {
  const { data } = await session.pos.get<PosInventoryItem>(`/assistant/inventory/${id}`);
  return data;
}

export async function readProduct(session: Session, id: string): Promise<PosProduct> {
  const { data } = await session.pos.get<PosProduct>(`/products/${id}`);
  return data;
}

/**
 * Each branch keeps its own items and products: a user who works at one may
 * only change that one's; whoever may see every branch may change any. Said
 * before anything is changed, in words the model can pass on, instead of
 * the POS's refusal at the end.
 */
export function assertOwnBranch(session: Session, branchId: string | undefined, what: string): void {
  if (session.branches.canSeeAll) return;
  if (session.branchId && branchId && branchId !== session.branchId) {
    throw new ToolRefusedError(`${what} es de otra sede: solo puedes cambiar los de tu sede.`);
  }
}

/**
 * A change that was made, with the branch it happened at when the user works
 * across several: the same item can exist at each one, so the answer has to
 * say which.
 */
export function atBranch(session: Session, message: string, branchId: string | undefined): string {
  if (!session.branches.canSeeAll || !branchId) return message;
  const branch = session.branches.list.find((candidate) => candidate.id === branchId);
  return branch ? `${message} Sede: ${branch.name}.` : message;
}
