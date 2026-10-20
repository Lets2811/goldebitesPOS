import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CreateAdjustmentDto } from '../dto/create-adjustment.dto';
import { LowStockQueryDto } from '../dto/low-stock-query.dto';
import { MovementQueryDto } from '../dto/movement-query.dto';
import { StockQueryDto } from '../dto/stock-query.dto';
import { InventoryMovementsService } from '../services/inventory-movements.service';
import { RequiresFeature } from '../../../common/decorators/requires-feature.decorator';
import { BranchOperation } from '../../../common/decorators/branch-operation.decorator';

@ApiTags('Inventory')
@ApiBearerAuth()
@RequiresFeature('inventory')
@BranchOperation()
@Controller('inventory')
export class InventoryMovementsController {
  constructor(private readonly movementsService: InventoryMovementsService) {}

  @Get('stock')
  @Permissions('inventory.read')
  @ApiOperation({
    summary: 'Current stock levels (derived from the movements ledger)',
  })
  getStock(
    @CurrentBusiness() businessId: string,
    @Query() query: StockQueryDto,
  ) {
    return this.movementsService.getStock({ businessId, ...query });
  }

  @Get('low-stock')
  @Permissions('inventory.read')
  @ApiOperation({
    summary: 'Inventory items currently below their minimum stock threshold',
  })
  getLowStock(
    @CurrentBusiness() businessId: string,
    @Query() query: LowStockQueryDto,
  ) {
    return this.movementsService.getLowStockAlerts(businessId, query.branchId);
  }

  @Get('movements')
  @Permissions('inventory.read')
  @ApiOperation({
    summary: 'Movement history (kardex), filterable and paginated',
  })
  getMovements(
    @CurrentBusiness() businessId: string,
    @Query() query: MovementQueryDto,
  ) {
    return this.movementsService.getKardex({
      businessId,
      page: query.page,
      limit: query.limit,
      branchId: query.branchId,
      inventoryItemId: query.inventoryItemId,
      movementType: query.movementType,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });
  }

  @Post('adjustments')
  @Permissions('inventory.adjust')
  @ApiOperation({ summary: 'Manually adjust stock up or down, with a reason' })
  createAdjustment(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Body() dto: CreateAdjustmentDto,
  ) {
    return this.movementsService.createAdjustment(
      { businessId, ...dto },
      actorUserId,
    );
  }
}
