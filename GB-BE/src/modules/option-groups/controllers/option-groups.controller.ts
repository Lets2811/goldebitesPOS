import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { RawResponse } from '../../../common/decorators/raw-response.decorator';
import { RequiresFeature } from '../../../common/decorators/requires-feature.decorator';
import {
  CreateOptionGroupDto,
  CreateOptionItemDto,
  SetOptionGroupOrderDto,
  UpdateOptionGroupDto,
  UpdateOptionItemDto,
} from '../dto/option-group.dto';
import { OptionGroupsService } from '../services/option-groups.service';

@ApiTags('Option groups')
@ApiBearerAuth()
@Controller('option-groups')
export class OptionGroupsController {
  constructor(private readonly optionGroupsService: OptionGroupsService) {}

  // No @Permissions: every screen that takes or shows an order (POS, kiosks,
  // kitchen) needs the business's groups and their options.
  @Get()
  @ApiOperation({
    summary:
      'Every option group of the current business with its options, active or not',
  })
  findAll(@CurrentBusiness() businessId: string) {
    return this.optionGroupsService.findAll(businessId);
  }

  @Post()
  @RequiresFeature('products')
  @Permissions('products.create')
  @ApiOperation({ summary: 'Create an option group (e.g. "Salsas", "Tamaño")' })
  createGroup(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Body() dto: CreateOptionGroupDto,
  ) {
    return this.optionGroupsService.createGroup(
      { businessId, ...dto },
      actorUserId,
    );
  }

  // Declared before ':id' so "order" is never read as an id.
  @Put('order')
  @RequiresFeature('products')
  @Permissions('products.update')
  @ApiOperation({ summary: 'Set the order the groups show in' })
  setOrder(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Body() dto: SetOptionGroupOrderDto,
  ) {
    return this.optionGroupsService.setGroupOrder(
      businessId,
      dto.groupIds,
      actorUserId,
    );
  }

  @Patch(':id')
  @RequiresFeature('products')
  @Permissions('products.update')
  @ApiOperation({ summary: 'Rename / reconfigure / turn off an option group' })
  updateGroup(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOptionGroupDto,
  ) {
    return this.optionGroupsService.updateGroup(
      businessId,
      id,
      dto,
      actorUserId,
    );
  }

  @Delete(':id')
  @RequiresFeature('products')
  @Permissions('products.update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RawResponse()
  @ApiOperation({
    summary:
      'Delete an option group for good (its options too; products stop offering it; past orders keep their names)',
  })
  async deleteGroup(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.optionGroupsService.deleteGroup(businessId, id, actorUserId);
  }

  @Post(':id/items')
  @RequiresFeature('products')
  @Permissions('products.create')
  @ApiOperation({ summary: 'Add an option to a group' })
  createItem(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id', ParseUUIDPipe) groupId: string,
    @Body() dto: CreateOptionItemDto,
  ) {
    return this.optionGroupsService.createItem(
      { businessId, groupId, ...dto },
      actorUserId,
    );
  }

  @Patch(':id/items/:itemId')
  @RequiresFeature('products')
  @Permissions('products.update')
  @ApiOperation({ summary: 'Edit / activate / deactivate an option' })
  updateItem(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id', ParseUUIDPipe) groupId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateOptionItemDto,
  ) {
    return this.optionGroupsService.updateItem(
      businessId,
      groupId,
      itemId,
      dto,
      actorUserId,
    );
  }

  @Delete(':id/items/:itemId')
  @RequiresFeature('products')
  @Permissions('products.update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RawResponse()
  @ApiOperation({
    summary: 'Delete an option for good (past orders keep its name)',
  })
  async deleteItem(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id', ParseUUIDPipe) groupId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    await this.optionGroupsService.deleteItem(
      businessId,
      groupId,
      itemId,
      actorUserId,
    );
  }
}
