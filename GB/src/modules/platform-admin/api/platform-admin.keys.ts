export const platformAdminKeys = {
  all: ['platform-admin'] as const,
  businesses: () => [...platformAdminKeys.all, 'businesses'] as const,
  features: (businessId: string) => [...platformAdminKeys.all, 'features', businessId] as const,
  users: (businessId: string) => [...platformAdminKeys.all, 'users', businessId] as const,
  branches: (businessId: string) => [...platformAdminKeys.all, 'branches', businessId] as const,
  featureFlags: () => [...platformAdminKeys.all, 'feature-flags'] as const,
};
