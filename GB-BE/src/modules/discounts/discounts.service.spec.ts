import {
  BusinessRuleException,
  ConflictException,
} from '../../common/exceptions';
import { DiscountsService } from './discounts.service';
import { DiscountRow, discountAmountFor } from './domain/discount';

describe('DiscountsService', () => {
  const businessId = 'business-1';
  let repository: Record<string, jest.Mock>;
  let service: DiscountsService;
  const day = 24 * 60 * 60 * 1000;

  const row = (overrides: Partial<DiscountRow> = {}): DiscountRow => ({
    id: 'discount-1',
    business_id: businessId,
    kind: 'COUPON',
    name: 'Verano',
    description: null,
    code: 'VERANO10',
    percent: '10.00',
    starts_at: null,
    ends_at: null,
    max_uses: null,
    used_count: 0,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    repository = {
      findByCode: jest.fn().mockResolvedValue(row()),
      findById: jest
        .fn()
        .mockResolvedValue(
          row({ kind: 'PROMOTION', code: null, name: 'Día de la madre' }),
        ),
      codeTaken: jest.fn().mockResolvedValue(false),
      create: jest.fn().mockResolvedValue(row()),
    };
    service = new DiscountsService(
      repository as never,
      { record: jest.fn() } as never,
    );
  });

  describe('resolve', () => {
    it('takes a manual percentage as given', async () => {
      await expect(
        service.resolve(businessId, { source: 'MANUAL', percent: 5 }),
      ).resolves.toEqual({
        source: 'MANUAL',
        percent: 5,
        discountId: null,
        label: 'Descuento manual (5%)',
      });
    });

    it('refuses a manual percentage out of range', async () => {
      await expect(
        service.resolve(businessId, { source: 'MANUAL', percent: 0 }),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('finds a coupon by its code', async () => {
      const applied = await service.resolve(businessId, {
        source: 'COUPON',
        code: 'verano10',
      });
      expect(repository.findByCode).toHaveBeenCalledWith(
        businessId,
        'verano10',
      );
      expect(applied).toMatchObject({
        percent: 10,
        discountId: 'discount-1',
        label: 'Cupón VERANO10 (10%)',
      });
    });

    it('labels a promotion with its name', async () => {
      const applied = await service.resolve(businessId, {
        source: 'PROMOTION',
        discountId: 'discount-1',
      });
      expect(applied.label).toBe('Día de la madre (10%)');
    });

    it.each([
      ['deactivated', { is_active: false }],
      ['not started', { starts_at: new Date(Date.now() + day) }],
      ['expired', { ends_at: new Date(Date.now() - day) }],
      ['out of uses', { max_uses: 3, used_count: 3 }],
    ])('refuses a coupon %s', async (_case, overrides) => {
      repository.findByCode.mockResolvedValue(row(overrides));
      await expect(
        service.resolve(businessId, { source: 'COUPON', code: 'VERANO10' }),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('does not take a coupon for a promotion', async () => {
      repository.findById.mockResolvedValue(row());
      await expect(
        service.resolve(businessId, {
          source: 'PROMOTION',
          discountId: 'discount-1',
        }),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  describe('create', () => {
    it('refuses a coupon code already in use', async () => {
      repository.codeTaken.mockResolvedValue(true);
      await expect(
        service.create(
          businessId,
          { kind: 'COUPON', name: 'Otro', code: 'VERANO10', percent: 5 },
          'user-1',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('refuses a coupon code with spaces', async () => {
      await expect(
        service.create(
          businessId,
          { kind: 'COUPON', name: 'Otro', code: 'MI CUPON', percent: 5 },
          'user-1',
        ),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  it('computes the amount off the subtotal, to the cent', () => {
    expect(discountAmountFor(20000, 5)).toBe(1000);
    expect(discountAmountFor(12345, 12.5)).toBe(1543.13);
  });
});
