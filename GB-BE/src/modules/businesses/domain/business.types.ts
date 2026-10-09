export interface CreateBusinessData {
  name: string;
  legalName?: string;
  taxId?: string;
  email?: string;
  phone?: string;
  currency?: string;
  timezone?: string;
}

export interface UpdateBusinessData {
  name?: string;
  /** For these four: null clears what is stored, undefined leaves it alone. */
  legalName?: string | null;
  taxId?: string | null;
  email?: string | null;
  phone?: string | null;
  currency?: string;
  timezone?: string;
}
