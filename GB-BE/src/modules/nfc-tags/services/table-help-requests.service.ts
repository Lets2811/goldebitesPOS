import { Inject, Injectable } from '@nestjs/common';
import { EntityNotFoundException } from '../../../common/exceptions';
import {
  PublicHelpRequestView,
  TableHelpRequest,
  TableHelpRequestRow,
} from '../domain/table-help-request.interface';
import { TABLE_HELP_REQUESTS_REPOSITORY } from '../repositories/table-help-requests.repository.interface';
import type { ITableHelpRequestsRepository } from '../repositories/table-help-requests.repository.interface';
import { NfcTagsService } from './nfc-tags.service';

function toDomain(row: TableHelpRequestRow): TableHelpRequest {
  return {
    id: row.id,
    businessId: row.business_id,
    branchId: row.branch_id,
    tableNumber: row.table_number,
    createdAt: row.created_at,
    attendedAt: row.attended_at,
  };
}

/** A table calling for staff from its NFC menu, and staff answering the call. */
@Injectable()
export class TableHelpRequestsService {
  constructor(
    @Inject(TABLE_HELP_REQUESTS_REPOSITORY)
    private readonly helpRequestsRepository: ITableHelpRequestsRepository,
    private readonly nfcTagsService: NfcTagsService,
  ) {}

  /**
   * Public, unauthenticated. The business, branch and table always come from
   * the token, never from the client. Available whether or not the table has
   * self-service: a table the waiter serves is the one most likely to call.
   */
  async requestFromToken(token: string): Promise<PublicHelpRequestView> {
    const resolution = await this.nfcTagsService.resolvePublic(token);
    const row = await this.helpRequestsRepository.openForTable(
      resolution.businessId,
      resolution.branchId,
      resolution.tableNumber,
    );
    return { requestedAt: row.created_at };
  }

  async findPending(
    businessId: string,
    branchId?: string,
  ): Promise<TableHelpRequest[]> {
    const rows = await this.helpRequestsRepository.findPending(
      businessId,
      branchId,
    );
    return rows.map(toDomain);
  }

  async attend(
    businessId: string,
    id: string,
    userId: string,
  ): Promise<TableHelpRequest> {
    const row = await this.helpRequestsRepository.markAttended(
      id,
      businessId,
      userId,
    );
    if (!row) {
      // Also the outcome when a colleague attended it first: either way there is nothing left to attend.
      throw new EntityNotFoundException('TableHelpRequest', id);
    }
    return toDomain(row);
  }
}
