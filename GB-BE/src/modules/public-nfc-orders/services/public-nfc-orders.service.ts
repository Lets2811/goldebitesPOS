import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleException, ConflictException } from '../../../common/exceptions';
import { PublicNfcResolution } from '../../nfc-tags/domain/nfc-tag.interface';
import { NfcTagsService } from '../../nfc-tags/services/nfc-tags.service';
import { OrderType } from '../../orders/domain/order.interface';
import { OrdersService } from '../../orders/services/orders.service';
import { SubmitNfcOrderDto } from '../dto/submit-nfc-order.dto';
import { PublicOrderView, toPublicOrderView } from '../mappers/public-order.mapper';
import { NFC_ORDER_SUBMISSIONS_REPOSITORY } from '../repositories/nfc-order-submissions.repository.interface';
import type { INfcOrderSubmissionsRepository } from '../repositories/nfc-order-submissions.repository.interface';

const STALE_CLAIM_MS = 30_000;

/**
 * Order creation/append for the public NFC menu — no admin auth, reuses
 * OrdersService.create()/addItems() exactly as the admin/waiter/kiosk flows
 * do (same validation, totals, stock, audit), never a parallel code path.
 */
@Injectable()
export class PublicNfcOrdersService {
  constructor(
    private readonly nfcTagsService: NfcTagsService,
    private readonly ordersService: OrdersService,
    @Inject(NFC_ORDER_SUBMISSIONS_REPOSITORY)
    private readonly submissionsRepository: INfcOrderSubmissionsRepository,
  ) {}

  async submit(token: string, dto: SubmitNfcOrderDto): Promise<PublicOrderView> {
    const resolution = await this.nfcTagsService.resolvePublic(token);
    // The menu hides the button, but the rule lives here: a table without
    // self-service cannot place an order no matter what the client sends.
    if (!resolution.selfServiceEnabled) {
      throw new BusinessRuleException(
        'Self-service is disabled for this table — a waiter takes the order',
        'SELF_SERVICE_DISABLED',
      );
    }
    const orderId = await this.claimAndExecute(resolution, dto, true);
    const order = await this.ordersService.findOne(resolution.businessId, orderId);
    return toPublicOrderView(order);
  }

  async getStatus(token: string, orderId: string): Promise<PublicOrderView> {
    const resolution = await this.nfcTagsService.resolvePublic(token);
    const order = await this.ordersService.findOne(resolution.businessId, orderId);
    return toPublicOrderView(order);
  }

  /**
   * Claims the idempotency key and does the real work, or resolves what an
   * earlier call with the same key already did — a true replay returns that
   * same order id, a same-key request still in flight throws (retryable)
   * SUBMISSION_IN_PROGRESS, and an abandoned claim (crash/timeout) older
   * than STALE_CLAIM_MS is freed and reclaimed once.
   */
  private async claimAndExecute(
    resolution: PublicNfcResolution,
    dto: SubmitNfcOrderDto,
    allowRetry: boolean,
  ): Promise<string> {
    const claimed = await this.submissionsRepository.claim(dto.idempotencyKey);
    if (claimed) {
      try {
        const orderId = await this.createOrAppend(resolution, dto);
        await this.submissionsRepository.linkOrder(dto.idempotencyKey, orderId);
        return orderId;
      } catch (error) {
        await this.submissionsRepository.deleteUnresolvedClaim(dto.idempotencyKey);
        throw error;
      }
    }

    const existing = await this.submissionsRepository.findByKey(dto.idempotencyKey);
    if (existing?.order_id) {
      return existing.order_id;
    }

    const isStale =
      existing && Date.now() - existing.created_at.getTime() >= STALE_CLAIM_MS;
    // No row at all (raced with another request's cleanup) is the same "safe to retry" shape as a stale claim.
    if (allowRetry && (isStale || !existing)) {
      if (existing) {
        await this.submissionsRepository.deleteUnresolvedClaim(dto.idempotencyKey);
      }
      return this.claimAndExecute(resolution, dto, false);
    }

    throw new ConflictException(
      'This submission is already being processed — try again shortly',
      'SUBMISSION_IN_PROGRESS',
    );
  }

  private async createOrAppend(
    resolution: PublicNfcResolution,
    dto: SubmitNfcOrderDto,
  ): Promise<string> {
    if (dto.orderType === OrderType.TAKEAWAY) {
      const order = await this.ordersService.create(
        {
          businessId: resolution.businessId,
          branchId: resolution.branchId,
          orderType: OrderType.TAKEAWAY,
        },
        dto.items,
      );
      await this.ordersService.tryAutoConfirm(resolution.businessId, order.id);
      return order.id;
    }

    const activeOrderId = await this.ordersService.findActiveIdForTable(
      resolution.businessId,
      resolution.branchId,
      resolution.tableNumber,
    );
    if (activeOrderId) {
      await this.ordersService.addItems(resolution.businessId, activeOrderId, dto.items);
      return activeOrderId;
    }

    const order = await this.ordersService.create(
      {
        businessId: resolution.businessId,
        branchId: resolution.branchId,
        orderType: OrderType.DINE_IN,
        tableNumber: resolution.tableNumber,
      },
      dto.items,
    );
    await this.ordersService.tryAutoConfirm(resolution.businessId, order.id);
    return order.id;
  }
}
