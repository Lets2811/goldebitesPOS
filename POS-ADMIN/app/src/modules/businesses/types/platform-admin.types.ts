import type { Business } from '../../../shared/modules/businesses/types/business.types';

export type { Business };

export interface CreatePlatformBusinessPayload {
  name: string;
  currency?: string;
  timezone?: string;
  ownerFirstName: string;
  ownerLastName: string;
  ownerEmail: string;
  ownerPassword: string;
}

export interface FeatureStatus {
  key: string;
  label: string;
  enabled: boolean;
  subFeatures?: FeatureStatus[];
}

/** Platform-wide flag — applies to every business at once, independent of FeatureStatus (per-business). */
export interface PlatformFeatureFlagStatus {
  key: string;
  label: string;
  enabled: boolean;
  moduleKey: string;
  moduleLabel: string;
}

export interface BusinessUserSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roleName: string;
  status: string;
}

/** What the platform can set on a branch; which branches a business has is the platform's to manage. */
export interface BranchDetailsPayload {
  name?: string;
  address?: string;
  city?: string;
  phone?: string;
}
