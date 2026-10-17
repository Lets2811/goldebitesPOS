export interface PublicNfcOrderItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  /** Lo elegido, por grupo: [{ groupName: "Salsas", itemNames: ["BBQ"] }]. */
  optionSelections: { groupName: string; itemNames: string[] }[];
  notes: string | null;
}

export interface PublicNfcOrder {
  id: string;
  orderNumber: string;
  status: string;
  orderType: string;
  tableNumber: string | null;
  items: PublicNfcOrderItem[];
  totalAmount: number;
  createdAt: string;
}

export interface SubmitNfcOrderItemPayload {
  productId: string;
  quantity: number;
  optionItemIds?: string[];
}

export interface SubmitNfcOrderPayload {
  orderType: 'DINE_IN' | 'TAKEAWAY';
  idempotencyKey: string;
  items: SubmitNfcOrderItemPayload[];
}
