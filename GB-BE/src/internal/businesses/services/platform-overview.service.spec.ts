import { EntityNotFoundException } from '../../../common/exceptions';
import { BusinessOverviewRow } from '../repositories/platform-overview.repository';
import { PlatformOverviewService } from './platform-overview.service';

describe('PlatformOverviewService', () => {
  const row = (
    overrides: Partial<BusinessOverviewRow> = {},
  ): BusinessOverviewRow => ({
    id: 'business-1',
    name: 'Golden Bites',
    legal_name: null,
    tax_id: '900123',
    email: null,
    phone: null,
    currency: 'COP',
    timezone: 'America/Bogota',
    is_active: true,
    created_at: new Date('2026-08-01'),
    has_logo: true,
    branch_count: 2,
    active_branch_count: 1,
    user_count: 4,
    last_login_at: null,
    tura_links: 3,
    e_configured: true,
    e_environment: 'SANDBOX',
    e_issued: 7,
    e_failed: 1,
    e_last_issued_at: null,
    orders_30d: 12,
    sales_30d: '450000.50',
    last_order_at: null,
    ...overrides,
  });
  const modules = [
    { key: 'orders', label: 'Pedidos', enabled: true },
    { key: 'tura', label: 'TURA', enabled: true },
    { key: 'einvoicing', label: 'Facturación', enabled: false },
  ];

  let repository: {
    businesses: jest.Mock;
    activity: jest.Mock;
    dailySales: jest.Mock;
  };
  let platformAdmin: { getBranches: jest.Mock; getBusinessUsers: jest.Mock };
  let service: PlatformOverviewService;

  beforeEach(() => {
    repository = {
      businesses: jest.fn().mockResolvedValue([row()]),
      activity: jest.fn().mockResolvedValue({
        products: 10,
        active_products: 8,
        inventory_items: 5,
        customers: 2,
        orders_total: 99,
        orders_today: 1,
        sales_today: '20000',
        orders_7d: 4,
        sales_7d: '80000',
      }),
      dailySales: jest
        .fn()
        .mockResolvedValue([{ date: '2026-10-20', orders: 3, sales: '60000' }]),
    };
    platformAdmin = {
      getBranches: jest.fn().mockResolvedValue([]),
      getBusinessUsers: jest.fn().mockResolvedValue([]),
    };
    service = new PlatformOverviewService(
      repository as never,
      { getEffectiveCatalog: jest.fn().mockResolvedValue(modules) } as never,
      platformAdmin as never,
    );
  });

  it('gives each business its figures, and where it stands with TURA and Factus', async () => {
    const [business] = await service.list();

    expect(business).toMatchObject({
      id: 'business-1',
      hasLogo: true,
      branches: { total: 2, active: 1 },
      activeUsers: 4,
      enabledModules: 2,
      last30Days: { orders: 12, sales: 450000.5 },
      tura: { enabled: true, links: 3 },
      eInvoicing: {
        enabled: false,
        configured: true,
        environment: 'SANDBOX',
        issued: 7,
        failed: 1,
      },
    });
  });

  it("adds a business's holdings, recent sales, branches and users for its page", async () => {
    const detail = await service.detail('business-1');

    expect(repository.businesses).toHaveBeenCalledWith('business-1');
    expect(repository.activity).toHaveBeenCalledWith(
      'business-1',
      'America/Bogota',
    );
    expect(detail).toMatchObject({
      taxId: '900123',
      holdings: {
        products: 10,
        activeProducts: 8,
        inventoryItems: 5,
        customers: 2,
      },
      sales: {
        today: { orders: 1, sales: 20000 },
        last7Days: { orders: 4, sales: 80000 },
        ordersAllTime: 99,
        daily: [{ date: '2026-10-20', orders: 3, sales: 60000 }],
      },
      modules,
    });
  });

  it('refuses a business that does not exist', async () => {
    repository.businesses.mockResolvedValue([]);

    await expect(service.detail('missing')).rejects.toThrow(
      EntityNotFoundException,
    );
  });
});
