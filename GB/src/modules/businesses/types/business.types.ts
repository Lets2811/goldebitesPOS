export interface Business {
  id: string;
  name: string;
  legalName: string | null;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  currency: string;
  timezone: string;
  taxRate: number;
  /** Whether the checkout offers the "Descuento" section (Configuración). */
  discountsAtCheckout: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** taxRate is NOT editable via PATCH /businesses/me — use the settings module (PATCH /settings) for that. */
export interface UpdateBusinessPayload {
  name?: string;
  legalName?: string;
  taxId?: string;
  email?: string;
  phone?: string;
  currency?: string;
  timezone?: string;
}
