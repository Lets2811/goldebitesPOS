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
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { RawResponse } from '../../../common/decorators/raw-response.decorator';
import { CreateInventoryItemDto } from '../dto/create-inventory-item.dto';
import { InventoryItemQueryDto } from '../dto/inventory-item-query.dto';
import { SetInventoryItemStatusDto } from '../dto/set-inventory-item-status.dto';
import { UpdateInventoryItemDto } from '../dto/update-inventory-item.dto';
import { InventoryItemsService } from '../services/inventory-items.service';
import { InventoryItemBranchesService } from '../services/inventory-item-branches.service';
import {
  BranchMinimumsQueryDto,
  SetBranchMinimumDto,
} from '../dto/set-branch-minimum.dto';
import { RequiresFeature } from '../../../common/decorators/requires-feature.decorator';

@ApiTags('Inventory Items')
@ApiBearerAuth()
@RequiresFeature('inventory')
@Controller('inventory-items')
export class InventoryItemsController {
  constructor(
    private readonly inventoryItemsService: InventoryItemsService,
    private readonly itemBranchesService: InventoryItemBranchesService,
  ) {}

  @Post()
  @Permissions('inventory.manage')
  @ApiOperation({ summary: 'Create an inventory item (insumo)' })
  create(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Body() dto: CreateInventoryItemDto,
  ) {
    return this.inventoryItemsService.create(
      { businessId, ...dto },
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
      page: query.page,
      limit: query.limit,
      categoryId: query.categoryId,
      isActive: query.isActive,
      search: query.search,
    });
  }

  @Get('branch-minimums')
  @Permissions('inventory.read')
  @ApiOperation({
    summary: 'The items with a minimum of their own at a branch',
  })
  branchMinimums(
    @CurrentBusiness() businessId: string,
    @Query() query: BranchMinimumsQueryDto,
  ) {
    return query.branchId
      ? this.itemBranchesService.minimumsAt(businessId, query.branchId)
      : [];
  }

  @Get(':id/branches')
  @Permissions('inventory.read')
  @ApiOperation({
    summary:
      "An item at each branch: its stock there and the minimum it's held to",
  })
  findBranches(@CurrentBusiness() businessId: string, @Param('id') id: string) {
    return this.itemBranchesService.findForItem(businessId, id);
  }

  @Put(':id/branches/:branchId')
  @Permissions('inventory.manage')
  @ApiOperation({ summary: "Set a branch's own minimum stock for an item" })
  setBranchMinimum(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
    @Param('branchId') branchId: string,
    @Body() dto: SetBranchMinimumDto,
  ) {
    return this.itemBranchesService.setMinimum(
      businessId,
      id,
      branchId,
      dto.minimumStock ?? null,
      actorUserId,
    );
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
