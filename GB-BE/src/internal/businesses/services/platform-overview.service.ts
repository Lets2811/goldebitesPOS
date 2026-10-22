import { Injectable } from '@nestjs/common';
import { EntityNotFoundException } from '../../../common/exceptions';
import { Branch } from '../../../modules/branches/domain/branch.interface';
import {
  BusinessFeaturesService,
  FeatureStatus,
} from '../../../modules/business-features/services/business-features.service';
import {
  BusinessOverviewRow,
  PlatformOverviewRepository,
} from '../repositories/platform-overview.repository';
import {
  BusinessUserSummary,
  PlatformAdminService,
} from './platform-admin.service';

/** The modules whose state the overview reports by name. */
const TURA_FEATURE = 'tura';
const E_INVOICING_FEATURE = 'einvoicing';

/** A business at a glance, as the Admin's cards and lists show it. */
export interface BusinessOverview {
  id: string;
  name: string;
  legalName: string | null;
  isActive: boolean;
  createdAt: Date;
  /** Whether GET internal/businesses/:id/logo has an image to give. */
  hasLogo: boolean;
  currency: string;
  branches: { total: number; active: number };
  activeUsers: number;
  lastLoginAt: Date | null;
  /** Modules switched on for the business (top-level ones). */
  enabledModules: number;
  last30Days: { orders: number; sales: number };
  lastOrderAt: Date | null;
  tura: { enabled: boolean; links: number };
  eInvoicing: {
    enabled: boolean;
    /** Factus credentials saved. */
    configured: boolean;
    environment: string | null;
    issued: number;
    failed: number;
    lastIssuedAt: Date | null;
  };
}

/** Everything the Admin knows about one business, for its own page. */
export interface BusinessDetail extends BusinessOverview {
  taxId: string | null;
  email: string | null;
  phone: string | null;
  timezone: string;
  holdings: {
    products: number;
    activeProducts: number;
    inventoryItems: number;
    customers: number;
  };
  sales: {
    today: { orders: number; sales: number };
    last7Days: { orders: number; sales: number };
    ordersAllTime: number;
    /** The last 30 days that had sales, by the business's calendar. */
    daily: { date: string; orders: number; sales: number }[];
  };
  modules: FeatureStatus[];
  branchList: Branch[];
  users: BusinessUserSummary[];
}

/**
 * The Golden Bites team's view of the businesses on the platform: how big
 * each one is, how active, and where it stands with TURA and Factus. Read
 * only; changes go through PlatformAdminService and the modules' own
 * internal routes.
 */
@Injectable()
export class PlatformOverviewService {
  constructor(
    private readonly repository: PlatformOverviewRepository,
    private readonly businessFeaturesService: BusinessFeaturesService,
    private readonly platformAdminService: PlatformAdminService,
  ) {}

  async list(): Promise<BusinessOverview[]> {
    const rows = await this.repository.businesses();
    return Promise.all(
      rows.map(async (row) =>
        this.toOverview(
          row,
          await this.businessFeaturesService.getEffectiveCatalog(row.id),
        ),
      ),
    );
  }

  async detail(businessId: string): Promise<BusinessDetail> {
    const [row] = await this.repository.businesses(businessId);
    if (!row) {
      throw new EntityNotFoundException('Business', businessId);
    }
    const [modules, activity, daily, branchList, users] = await Promise.all([
      this.businessFeaturesService.getEffectiveCatalog(businessId),
      this.repository.activity(businessId, row.timezone),
      this.repository.dailySales(businessId, row.timezone),
      this.platformAdminService.getBranches(businessId),
      this.platformAdminService.getBusinessUsers(businessId),
    ]);
    return {
      ...this.toOverview(row, modules),
      taxId: row.tax_id,
      email: row.email,
      phone: row.phone,
      timezone: row.timezone,
      holdings: {
        products: activity.products,
        activeProducts: activity.active_products,
        inventoryItems: activity.inventory_items,
        customers: activity.customers,
      },
      sales: {
        today: {
          orders: activity.orders_today,
          sales: parseFloat(activity.sales_today),
        },
        last7Days: {
          orders: activity.orders_7d,
          sales: parseFloat(activity.sales_7d),
        },
        ordersAllTime: activity.orders_total,
        daily: daily.map((day) => ({
          date: day.date,
          orders: day.orders,
          sales: parseFloat(day.sales),
        })),
      },
      modules,
      branchList,
      users,
    };
  }

  private toOverview(
    row: BusinessOverviewRow,
    modules: FeatureStatus[],
  ): BusinessOverview {
    const enabled = new Set(
      modules.filter((module) => module.enabled).map((module) => module.key),
    );
    return {
      id: row.id,
      name: row.name,
      legalName: row.legal_name,
      isActive: row.is_active,
      createdAt: row.created_at,
      hasLogo: row.has_logo,
      currency: row.currency,
      branches: { total: row.branch_count, active: row.active_branch_count },
      activeUsers: row.user_count,
      lastLoginAt: row.last_login_at,
      enabledModules: enabled.size,
      last30Days: { orders: row.orders_30d, sales: parseFloat(row.sales_30d) },
      lastOrderAt: row.last_order_at,
      tura: { enabled: enabled.has(TURA_FEATURE), links: row.tura_links },
      eInvoicing: {
        enabled: enabled.has(E_INVOICING_FEATURE),
        configured: row.e_configured,
        environment: row.e_environment,
        issued: row.e_issued,
        failed: row.e_failed,
        lastIssuedAt: row.e_last_issued_at,
      },
    };
  }
}
