import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CountQueryDto } from '../dto/count-query.dto';
import { RecordCountDto } from '../dto/record-count.dto';
import { StartCountDto } from '../dto/start-count.dto';
import { InventoryCountsService } from '../services/inventory-counts.service';
import { RequiresFeature } from '../../../common/decorators/requires-feature.decorator';
import { BranchOperation } from '../../../common/decorators/branch-operation.decorator';

@ApiTags('Inventory Counts')
@ApiBearerAuth()
@RequiresFeature('inventory')
@BranchOperation()
@Controller('inventory/counts')
export class InventoryCountsController {
  constructor(private readonly countsService: InventoryCountsService) {}

  @Post()
  @Permissions('inventory.count')
  @ApiOperation({
    summary: 'Start a physical count, snapshotting expected quantities',
  })
  start(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Body() dto: StartCountDto,
  ) {
    return this.countsService.start({ businessId, ...dto }, actorUserId);
  }

  @Get()
  @Permissions('inventory.read')
  @ApiOperation({ summary: 'List physical counts' })
  findAll(
    @CurrentBusiness() businessId: string,
    @Query() query: CountQueryDto,
  ) {
    return this.countsService.findAll({
      businessId,
      page: query.page,
      limit: query.limit,
      status: query.status,
      branchId: query.branchId,
    });
  }

  @Get(':id')
  @Permissions('inventory.read')
  @ApiOperation({
    summary: 'Get a count with expected/counted quantities per item',
  })
  findOne(@CurrentBusiness() businessId: string, @Param('id') id: string) {
    return this.countsService.findOne(businessId, id);
  }

  @Put(':id/items')
  @Permissions('inventory.count')
  @ApiOperation({
    summary: 'Record the counted quantity for one item in the count',
  })
  recordCount(
    @CurrentBusiness() businessId: string,
    @Param('id') id: string,
    @Body() dto: RecordCountDto,
  ) {
    return this.countsService.recordCount(
      businessId,
      id,
      dto.inventoryItemId,
      dto.countedQuantity,
    );
  }

  @Post(':id/complete')
  @Permissions('inventory.count')
  @ApiOperation({
    summary:
      'Complete the count: posts ADJUSTMENT_IN/OUT for every discrepancy',
  })
  complete(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
  ) {
    return this.countsService.complete(businessId, id, actorUserId);
  }

  @Post(':id/cancel')
  @Permissions('inventory.count')
  @ApiOperation({ summary: 'Cancel an in-progress count' })
  cancel(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
  ) {
    return this.countsService.cancel(businessId, id, actorUserId);
  }
}
