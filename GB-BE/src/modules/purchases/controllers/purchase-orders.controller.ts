import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CreatePurchaseOrderDto } from '../dto/create-purchase-order.dto';
import { PurchaseOrderQueryDto } from '../dto/purchase-order-query.dto';
import { PurchaseOrdersService } from '../services/purchase-orders.service';
import { RequiresFeature } from '../../../common/decorators/requires-feature.decorator';
import { BranchOperation } from '../../../common/decorators/branch-operation.decorator';

@ApiTags('Purchases')
@ApiBearerAuth()
@RequiresFeature('purchases')
@BranchOperation()
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Post()
  @Permissions('purchases.create')
  @ApiOperation({ summary: 'Create a purchase order in DRAFT status' })
  create(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Body() dto: CreatePurchaseOrderDto,
  ) {
    const { items, ...rest } = dto;
    return this.purchaseOrdersService.create(
      { businessId, ...rest },
      items,
      actorUserId,
    );
  }

  @Get()
  @Permissions('purchases.read')
  @ApiOperation({ summary: 'List purchase orders' })
  findAll(
    @CurrentBusiness() businessId: string,
    @Query() query: PurchaseOrderQueryDto,
  ) {
    return this.purchaseOrdersService.findAll({
      businessId,
      page: query.page,
      limit: query.limit,
      status: query.status,
      branchId: query.branchId,
      supplierId: query.supplierId,
    });
  }

  @Get(':id')
  @Permissions('purchases.read')
  @ApiOperation({ summary: 'Get a purchase order with its items' })
  findOne(@CurrentBusiness() businessId: string, @Param('id') id: string) {
    return this.purchaseOrdersService.findOne(businessId, id);
  }

  @Post(':id/submit')
  @Permissions('purchases.create')
  @ApiOperation({ summary: 'Submit a draft purchase order for approval' })
  submit(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
  ) {
    return this.purchaseOrdersService.submit(businessId, id, actorUserId);
  }

  @Post(':id/approve')
  @Permissions('purchases.approve')
  @ApiOperation({ summary: 'Approve a submitted purchase order' })
  approve(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
  ) {
    return this.purchaseOrdersService.approve(businessId, id, actorUserId);
  }

  @Post(':id/cancel')
  @Permissions('purchases.cancel')
  @ApiOperation({
    summary:
      'Cancel a purchase order (approved orders only if nothing was received yet)',
  })
  cancel(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
  ) {
    return this.purchaseOrdersService.cancel(businessId, id, actorUserId);
  }
}
