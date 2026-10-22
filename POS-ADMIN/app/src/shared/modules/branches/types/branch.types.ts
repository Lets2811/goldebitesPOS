export interface Branch {
  id: string;
  businessId: string;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  tableCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BranchFilters {
  page?: number;
  limit?: number;
  isActive?: boolean;
  search?: string;
}

/** All a business can change about a branch; the rest is managed by the platform. */
export interface UpdateBranchPayload {
  tableCount: number;
}
