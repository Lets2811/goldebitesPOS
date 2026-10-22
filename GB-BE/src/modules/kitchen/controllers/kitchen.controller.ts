import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { KitchenQueueQueryDto } from '../dto/kitchen-queue-query.dto';
import { UpdateKitchenStatusDto } from '../dto/update-kitchen-status.dto';
import { KitchenService } from '../services/kitchen.service';
import { RequiresFeature } from '../../../common/decorators/requires-feature.decorator';
import { BranchOperation } from '../../../common/decorators/branch-operation.decorator';

@ApiTags('Kitchen')
@ApiBearerAuth()
@RequiresFeature('kitchen')
@BranchOperation()
@Controller('kitchen')
export class KitchenController {
  constructor(private readonly kitchenService: KitchenService) {}

  @Get('orders')
  @Permissions('kitchen.read')
  @ApiOperation({
    summary: 'Orders currently confirmed or in preparation, oldest first',
  })
  getQueue(
    @CurrentBusiness() businessId: string,
    @Query() query: KitchenQueueQueryDto,
  ) {
    return this.kitchenService.getQueue(businessId, query.branchId);
  }

  @Patch('orders/:id/status')
  @Permissions('kitchen.update_status')
  @ApiOperation({ summary: 'Mark an order as PREPARING or READY' })
  updateStatus(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
    @Body() dto: UpdateKitchenStatusDto,
  ) {
    return this.kitchenService.updateStatus(
      businessId,
      id,
      dto.status,
      actorUserId,
    );
  }
}
