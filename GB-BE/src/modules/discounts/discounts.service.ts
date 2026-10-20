import { Injectable } from '@nestjs/common';
import {
  BusinessRuleException,
  ConflictException,
  EntityNotFoundException,
} from '../../common/exceptions';
import { DbClient } from '../../database/types/database.types';
import { AuditService } from '../audit/services/audit.service';
import { DiscountsRepository } from './discounts.repository';
import {
  AppliedDiscount,
  Discount,
  DiscountInput,
  DiscountKind,
  DiscountRow,
  DiscountSource,
  formatPercent,
  unusableReason,
} from './domain/discount';

const toDiscount = (row: DiscountRow, now = new Date()): Discount => ({
  id: row.id,
  kind: row.kind,
  name: row.name,
  description: row.description,
  code: row.code,
  percent: Number(row.percent),
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  maxUses: row.max_uses,
  usedCount: row.used_count,
  isActive: row.is_active,
  usableNow: unusableReason(row, now) === null,
  createdAt: row.created_at,
});

/** What the cashier chose at checkout. */
export interface CheckoutDiscountChoice {
  source: DiscountSource;
  /** MANUAL: the percentage typed. */
  percent?: number;
  /** PROMOTION: the one picked from the list. */
  discountId?: string;
  /** COUPON: the code the customer gave. */
  code?: string;
}

/**
 * Promotions (for events and seasons, picked from a list when charging) and
 * coupons (applied by their code), and turning what the cashier chose at
 * checkout into the discount an order carries.
 */
@Injectable()
export class DiscountsService {
  constructor(
    private readonly repository: DiscountsRepository,
    private readonly auditService: AuditService,
  ) {}

  async findAll(businessId: string, kind?: DiscountKind): Promise<Discount[]> {
    const now = new Date();
    return (await this.repository.findAll(businessId, kind)).map((row) =>
      toDiscount(row, now),
    );
  }

  /** The promotions a cashier can pick right now (coupons are entered by code). */
  async findAvailablePromotions(businessId: string): Promise<Discount[]> {
    return (await this.findAll(businessId, 'PROMOTION')).filter(
      (d) => d.usableNow,
    );
  }

  async create(
    businessId: string,
    input: DiscountInput,
    actorUserId: string,
  ): Promise<Discount> {
    await this.validate(businessId, input);
    const row = await this.repository.create(businessId, input, actorUserId);
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'discount',
      entityId: row.id,
      action: 'CREATE',
      newValues: {
        kind: row.kind,
        name: row.name,
        code: row.code,
        percent: Number(row.percent),
      },
    });
    return toDiscount(row);
  }

  async update(
    businessId: string,
    id: string,
    input: DiscountInput,
    actorUserId: string,
  ): Promise<Discount> {
    const current = await this.getOrFail(businessId, id);
    if (input.kind !== current.kind) {
      throw new BusinessRuleException(
        'Un descuento no puede cambiar de tipo',
        'DISCOUNT_KIND_FIXED',
      );
    }
    await this.validate(businessId, input, id);
    const row = await this.repository.update(businessId, id, input);
    if (!row) throw new EntityNotFoundException('Discount', id);
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'discount',
      entityId: id,
      action: 'UPDATE',
      oldValues: {
        name: current.name,
        percent: Number(current.percent),
        isActive: current.is_active,
      },
      newValues: {
        name: row.name,
        percent: Number(row.percent),
        isActive: row.is_active,
      },
    });
    return toDiscount(row);
  }

  async remove(
    businessId: string,
    id: string,
    actorUserId: string,
  ): Promise<void> {
    if (!(await this.repository.softDelete(businessId, id))) {
      throw new EntityNotFoundException('Discount', id);
    }
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'discount',
      entityId: id,
      action: 'DELETE',
    });
  }

  /**
   * The discount an order gets from what the cashier chose. Throws with a
   * message for the cashier when a promotion or coupon cannot be used.
   */
  async resolve(
    businessId: string,
    choice: CheckoutDiscountChoice,
  ): Promise<AppliedDiscount> {
    if (choice.source === 'MANUAL') {
      const percent = Number(choice.percent);
      if (!(percent > 0 && percent <= 100)) {
        throw new BusinessRuleException(
          'El porcentaje debe estar entre 0 y 100',
          'DISCOUNT_PERCENT_INVALID',
        );
      }
      return {
        source: 'MANUAL',
        percent,
        discountId: null,
        label: `Descuento manual (${formatPercent(percent)}%)`,
      };
    }

    const row =
      choice.source === 'COUPON'
        ? choice.code?.trim()
          ? await this.repository.findByCode(businessId, choice.code)
          : null
        : choice.discountId
          ? await this.repository.findById(businessId, choice.discountId)
          : null;
    if (!row || row.kind !== choice.source) {
      throw new BusinessRuleException(
        choice.source === 'COUPON'
          ? 'Ese cupón no existe'
          : 'Esa promoción no existe',
        'DISCOUNT_NOT_FOUND',
      );
    }
    const reason = unusableReason(row, new Date());
    if (reason) {
      throw new BusinessRuleException(
        `${row.kind === 'COUPON' ? 'El cupón' : 'La promoción'} "${row.code ?? row.name}" ${reason}`,
        'DISCOUNT_NOT_USABLE',
      );
    }
    const percent = Number(row.percent);
    return {
      source: row.kind,
      percent,
      discountId: row.id,
      label:
        row.kind === 'COUPON'
          ? `Cupón ${row.code} (${formatPercent(percent)}%)`
          : `${row.name} (${formatPercent(percent)}%)`,
    };
  }

  /** Counts a promotion's or coupon's use for an order; false when it has none left. */
  takeUse(id: string, client: DbClient): Promise<boolean> {
    return this.repository.takeUse(id, client);
  }

  /** Gives a use back (the order changed or dropped its discount). */
  releaseUse(id: string, client: DbClient): Promise<void> {
    return this.repository.releaseUse(id, client);
  }

  private async validate(
    businessId: string,
    input: DiscountInput,
    exceptId?: string,
  ): Promise<void> {
    if (input.kind === 'COUPON') {
      const code = input.code?.trim() ?? '';
      if (!/^[A-Za-z0-9_-]{3,30}$/.test(code)) {
        throw new BusinessRuleException(
          'El código del cupón debe tener de 3 a 30 letras, números, guiones o guiones bajos',
          'DISCOUNT_CODE_INVALID',
        );
      }
      if (await this.repository.codeTaken(businessId, code, exceptId)) {
        throw new ConflictException(
          `Ya existe un cupón con el código ${code.toUpperCase()}`,
          'DISCOUNT_CODE_TAKEN',
        );
      }
    }
    if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) {
      throw new BusinessRuleException(
        'La fecha final debe ser posterior a la inicial',
        'DISCOUNT_DATES_INVALID',
      );
    }
  }

  private async getOrFail(
    businessId: string,
    id: string,
  ): Promise<DiscountRow> {
    const row = await this.repository.findById(businessId, id);
    if (!row) throw new EntityNotFoundException('Discount', id);
    return row;
  }
}
