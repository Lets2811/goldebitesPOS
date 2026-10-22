import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentBranch } from '../../../common/decorators/current-branch.decorator';
import { requireBranch } from '../../../common/utils/require-branch.util';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { RawResponse } from '../../../common/decorators/raw-response.decorator';
import { CreateInventoryItemDto } from '../dto/create-inventory-item.dto';
import { InventoryItemQueryDto } from '../dto/inventory-item-query.dto';
import { SetInventoryItemStatusDto } from '../dto/set-inventory-item-status.dto';
import { UpdateInventoryItemDto } from '../dto/update-inventory-item.dto';
import { InventoryItemsService } from '../services/inventory-items.service';
import { RequiresFeature } from '../../../common/decorators/requires-feature.decorator';

@ApiTags('Inventory Items')
@ApiBearerAuth()
@RequiresFeature('inventory')
@Controller('inventory-items')
export class InventoryItemsController {
  constructor(private readonly inventoryItemsService: InventoryItemsService) {}

  @Post()
  @Permissions('inventory.manage')
  @ApiOperation({ summary: 'Create an inventory item (insumo)' })
  create(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @CurrentBranch() sessionBranchId: string | null,
    @Body() dto: CreateInventoryItemDto,
  ) {
    return this.inventoryItemsService.create(
      {
        businessId,
        ...dto,
        branchId: requireBranch(dto.branchId ?? sessionBranchId),
      },
      actorUserId,
    );
  }

  @Get()
  @Permissions('inventory.read')
  @ApiOperation({ summary: 'List inventory items for the current business' })
  findAll(
    @CurrentBusiness() businessId: string,
    @Query() query: InventoryItemQueryDto,
  ) {
    return this.inventoryItemsService.findAll({
      businessId,
      branchId: query.branchId,
      page: query.page,
      limit: query.limit,
      categoryId: query.categoryId,
      isActive: query.isActive,
      search: query.search,
    });
  }

  @Get(':id')
  @Permissions('inventory.read')
  @ApiOperation({ summary: 'Get a single inventory item' })
  findOne(@CurrentBusiness() businessId: string, @Param('id') id: string) {
    return this.inventoryItemsService.findOne(businessId, id);
  }

  @Patch(':id')
  @Permissions('inventory.manage')
  @ApiOperation({ summary: 'Update an inventory item' })
  update(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
    @Body() dto: UpdateInventoryItemDto,
  ) {
    return this.inventoryItemsService.update(businessId, id, dto, actorUserId);
  }

  @Patch(':id/status')
  @Permissions('inventory.manage')
  @ApiOperation({ summary: 'Activate or deactivate an inventory item' })
  setStatus(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
    @Body() dto: SetInventoryItemStatusDto,
  ) {
    return this.inventoryItemsService.setActive(
      businessId,
      id,
      dto.isActive,
      actorUserId,
    );
  }

  @Delete(':id')
  @Permissions('inventory.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RawResponse()
  @ApiOperation({ summary: 'Soft delete an inventory item' })
  async remove(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
  ) {
    await this.inventoryItemsService.softDelete(businessId, id, actorUserId);
  }
}
