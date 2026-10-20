import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CreateTransferDto } from '../dto/create-transfer.dto';
import { TransferQueryDto } from '../dto/transfer-query.dto';
import { InventoryTransfersService } from '../services/inventory-transfers.service';
import { RequiresFeature } from '../../../common/decorators/requires-feature.decorator';
import { BranchOperation } from '../../../common/decorators/branch-operation.decorator';

@ApiTags('Inventory Transfers')
@ApiBearerAuth()
@RequiresFeature('inventory')
@BranchOperation()
@Controller('inventory/transfers')
export class InventoryTransfersController {
  constructor(private readonly transfersService: InventoryTransfersService) {}

  @Post()
  @Permissions('inventory.transfer')
  @ApiOperation({
    summary: 'Request a transfer of items between branches/locations',
  })
  create(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Body() dto: CreateTransferDto,
  ) {
    const { items, ...rest } = dto;
    return this.transfersService.create(
      { businessId, ...rest },
      items,
      actorUserId,
    );
  }

  @Get()
  @Permissions('inventory.read')
  @ApiOperation({ summary: 'List inventory transfers' })
  findAll(
    @CurrentBusiness() businessId: string,
    @Query() query: TransferQueryDto,
  ) {
    return this.transfersService.findAll({
      businessId,
      page: query.page,
      limit: query.limit,
      status: query.status,
      branchId: query.branchId,
    });
  }

  @Get(':id')
  @Permissions('inventory.read')
  @ApiOperation({ summary: 'Get a transfer with its items' })
  findOne(@CurrentBusiness() businessId: string, @Param('id') id: string) {
    return this.transfersService.findOne(businessId, id);
  }

  @Post(':id/complete')
  @Permissions('inventory.transfer')
  @ApiOperation({
    summary: 'Complete a transfer: posts TRANSFER_OUT/TRANSFER_IN movements',
  })
  complete(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
  ) {
    return this.transfersService.complete(businessId, id, actorUserId);
  }

  @Post(':id/cancel')
  @Permissions('inventory.transfer')
  @ApiOperation({ summary: 'Cancel a pending transfer' })
  cancel(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
  ) {
    return this.transfersService.cancel(businessId, id, actorUserId);
  }
}
