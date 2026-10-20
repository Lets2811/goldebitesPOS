import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CreateWasteRecordDto } from '../dto/create-waste-record.dto';
import { WasteRecordQueryDto } from '../dto/waste-record-query.dto';
import { WasteRecordsService } from '../services/waste-records.service';
import { RequiresFeature } from '../../../common/decorators/requires-feature.decorator';
import { BranchOperation } from '../../../common/decorators/branch-operation.decorator';

@ApiTags('Waste')
@ApiBearerAuth()
@RequiresFeature('waste')
@BranchOperation()
@Controller('waste')
export class WasteRecordsController {
  constructor(private readonly wasteRecordsService: WasteRecordsService) {}

  @Post()
  @Permissions('inventory.adjust')
  @ApiOperation({
    summary: 'Record spoilage/waste, posting a WASTE inventory movement',
  })
  create(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Body() dto: CreateWasteRecordDto,
  ) {
    return this.wasteRecordsService.create({ businessId, ...dto }, actorUserId);
  }

  @Get()
  @Permissions('inventory.read')
  @ApiOperation({ summary: 'List waste records' })
  findAll(
    @CurrentBusiness() businessId: string,
    @Query() query: WasteRecordQueryDto,
  ) {
    return this.wasteRecordsService.findAll({
      businessId,
      page: query.page,
      limit: query.limit,
      branchId: query.branchId,
      inventoryItemId: query.inventoryItemId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });
  }
}
