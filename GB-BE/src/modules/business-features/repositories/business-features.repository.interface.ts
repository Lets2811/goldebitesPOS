export interface DisabledFeatureRow {
  feature_key: string;
}

export interface IBusinessFeaturesRepository {
  findDisabledKeys(businessId: string): Promise<string[]>;
  /** The keys a business has a row turning on; what opt-in features need to count as enabled. */
  findEnabledKeys(businessId: string): Promise<string[]>;
  setEnabled(
    businessId: string,
    featureKey: string,
    enabled: boolean,
  ): Promise<void>;
}

export const BUSINESS_FEATURES_REPOSITORY = Symbol(
  'BUSINESS_FEATURES_REPOSITORY',
);
