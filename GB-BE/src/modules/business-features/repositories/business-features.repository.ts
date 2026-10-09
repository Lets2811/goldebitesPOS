import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import {
  DisabledFeatureRow,
  IBusinessFeaturesRepository,
} from './business-features.repository.interface';

@Injectable()
export class BusinessFeaturesRepository implements IBusinessFeaturesRepository {
  constructor(private readonly db: DatabaseService) {}

  async findDisabledKeys(businessId: string): Promise<string[]> {
    return this.findKeys(businessId, false);
  }

  async findEnabledKeys(businessId: string): Promise<string[]> {
    return this.findKeys(businessId, true);
  }

  async setEnabled(
    businessId: string,
    featureKey: string,
    enabled: boolean,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO business_features (business_id, feature_key, enabled)
       VALUES ($1, $2, $3)
       ON CONFLICT (business_id, feature_key) DO UPDATE SET enabled = $3, updated_at = now()`,
      [businessId, featureKey, enabled],
    );
  }

  private async findKeys(
    businessId: string,
    enabled: boolean,
  ): Promise<string[]> {
    const result = await this.db.query<DisabledFeatureRow>(
      `SELECT feature_key FROM business_features WHERE business_id = $1 AND enabled = $2`,
      [businessId, enabled],
    );
    return result.rows.map((row) => row.feature_key);
  }
}
