import { DbClient } from '../../../database/types/database.types';
import { BusinessLogoRow, BusinessRow } from '../domain/business.interface';
import {
  CreateBusinessData,
  UpdateBusinessData,
} from '../domain/business.types';

export interface IBusinessesRepository {
  create(data: CreateBusinessData, client?: DbClient): Promise<BusinessRow>;
  findAll(): Promise<BusinessRow[]>;
  findById(id: string, client?: DbClient): Promise<BusinessRow | null>;
  update(
    id: string,
    data: UpdateBusinessData,
    client?: DbClient,
  ): Promise<BusinessRow | null>;
  setActive(
    id: string,
    isActive: boolean,
    client?: DbClient,
  ): Promise<BusinessRow | null>;
  updateTaxRate(
    id: string,
    taxRate: number,
    client?: DbClient,
  ): Promise<BusinessRow | null>;
  updateDiscountsAtCheckout(
    id: string,
    enabled: boolean,
    client?: DbClient,
  ): Promise<BusinessRow | null>;
  updateLoyaltyConfig(
    id: string,
    data: {
      pointsPerThousand?: number;
      birthdayBonusEnabled?: boolean;
      birthdayBonusPoints?: number;
    },
    client?: DbClient,
  ): Promise<BusinessRow | null>;
  setLogo(id: string, logoPath: string, mimeType: string): Promise<void>;
  getLogo(id: string): Promise<BusinessLogoRow | null>;
  clearLogo(id: string): Promise<void>;
}

export const BUSINESSES_REPOSITORY = Symbol('BUSINESSES_REPOSITORY');
