import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CreateGoodsReceiptDto } from '../dto/create-goods-receipt.dto';
import { GoodsReceiptQueryDto } from '../dto/goods-receipt-query.dto';
import { GoodsReceiptsService } from '../services/goods-receipts.service';
import { RequiresFeature } from '../../../common/decorators/requires-feature.decorator';
import { BranchOperation } from '../../../common/decorators/branch-operation.decorator';

@ApiTags('Purchases')
@ApiBearerAuth()
@RequiresFeature('purchases')
@BranchOperation()
@Controller('goods-receipts')
export class GoodsReceiptsController {
  constructor(private readonly goodsReceiptsService: GoodsReceiptsService) {}

  @Post()
  @Permissions('purchases.receive')
  @ApiOperation({
    summary:
      'Receive goods against an approved purchase order (partial or full)',
  })
  receive(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Body() dto: CreateGoodsReceiptDto,
  ) {
    return this.goodsReceiptsService.receive(
      businessId,
      dto.purchaseOrderId,
      dto.items,
      dto.notes,
      actorUserId,
    );
  }

  @Get()
  @Permissions('purchases.read')
  @ApiOperation({ summary: 'List goods receipts' })
  findAll(
    @CurrentBusiness() businessId: string,
    @Query() query: GoodsReceiptQueryDto,
  ) {
    return this.goodsReceiptsService.findAll({
      businessId,
      page: query.page,
      limit: query.limit,
      purchaseOrderId: query.purchaseOrderId,
    });
  }

  @Get(':id')
  @Permissions('purchases.read')
  @ApiOperation({ summary: 'Get a goods receipt with its items' })
  findOne(@CurrentBusiness() businessId: string, @Param('id') id: string) {
    return this.goodsReceiptsService.findOne(businessId, id);
  }
}
