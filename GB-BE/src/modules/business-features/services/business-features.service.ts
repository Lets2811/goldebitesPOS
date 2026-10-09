import { Inject, Injectable } from '@nestjs/common';
import {
  ALL_FEATURE_KEYS,
  FEATURE_MODULES,
  OPT_IN_FEATURE_KEYS,
  isKeyEnabled,
} from '../../../common/constants/feature-modules.constants';
import { EntityNotFoundException } from '../../../common/exceptions';
import { BUSINESS_FEATURES_REPOSITORY } from '../repositories/business-features.repository.interface';
import type { IBusinessFeaturesRepository } from '../repositories/business-features.repository.interface';

export interface FeatureStatus {
  key: string;
  label: string;
  enabled: boolean;
  subFeatures?: FeatureStatus[];
}

@Injectable()
export class BusinessFeaturesService {
  constructor(
    @Inject(BUSINESS_FEATURES_REPOSITORY)
    private readonly businessFeaturesRepository: IBusinessFeaturesRepository,
  ) {}

  /** All feature keys (modules and sub-features) enabled for a business, cascade already applied. */
  async getEnabledKeys(businessId: string): Promise<string[]> {
    const disabled = await this.findOffKeys(businessId);
    return ALL_FEATURE_KEYS.filter((key) => isKeyEnabled(key, disabled));
  }

  async getEffectiveCatalog(businessId: string): Promise<FeatureStatus[]> {
    const disabled = await this.findOffKeys(businessId);
    return FEATURE_MODULES.map((module) => {
      const moduleEnabled = isKeyEnabled(module.key, disabled);
      return {
        key: module.key,
        label: module.label,
        enabled: moduleEnabled,
        ...(module.subFeatures && {
          subFeatures: module.subFeatures.map((sub) => ({
            key: sub.key,
            label: sub.label,
            enabled: moduleEnabled && isKeyEnabled(sub.key, disabled),
          })),
        }),
      };
    });
  }

  async setFeature(
    businessId: string,
    featureKey: string,
    enabled: boolean,
  ): Promise<void> {
    if (!ALL_FEATURE_KEYS.includes(featureKey)) {
      throw new EntityNotFoundException('Feature', featureKey);
    }
    await this.businessFeaturesRepository.setEnabled(
      businessId,
      featureKey,
      enabled,
    );
  }

  /**
   * Every key that is off for a business: the ones it has turned off, plus
   * the opt-in ones (paid add-ons) it was never given.
   */
  private async findOffKeys(businessId: string): Promise<Set<string>> {
    const [disabled, enabled] = await Promise.all([
      this.businessFeaturesRepository.findDisabledKeys(businessId),
      this.businessFeaturesRepository.findEnabledKeys(businessId),
    ]);
    const granted = new Set(enabled);
    return new Set([
      ...disabled,
      ...OPT_IN_FEATURE_KEYS.filter((key) => !granted.has(key)),
    ]);
  }
}
