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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { RawResponse } from '../../../common/decorators/raw-response.decorator';
import { RequiresFeature } from '../../../common/decorators/requires-feature.decorator';
import {
  CreateExpenseCategoryDto,
  UpdateExpenseCategoryDto,
} from '../dto/expense-category.dto';
import { ExpenseCategoriesService } from '../services/expense-categories.service';

@ApiTags('Finances')
@ApiBearerAuth()
@RequiresFeature('finances')
@Controller('expense-categories')
export class ExpenseCategoriesController {
  constructor(private readonly categoriesService: ExpenseCategoriesService) {}

  @Get()
  @Permissions('finances.read')
  @ApiOperation({
    summary: "List the business's expense categories, active and inactive",
  })
  findAll(@CurrentBusiness() businessId: string) {
    return this.categoriesService.findAll(businessId);
  }

  @Post()
  @Permissions('finances.manage')
  @ApiOperation({ summary: 'Add an expense category' })
  create(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Body() dto: CreateExpenseCategoryDto,
  ) {
    return this.categoriesService.create({ businessId, ...dto }, actorUserId);
  }

  @Patch(':id')
  @Permissions('finances.manage')
  @ApiOperation({
    summary:
      'Rename an expense category, mark it as cost of sales, or activate/deactivate it',
  })
  update(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExpenseCategoryDto,
  ) {
    return this.categoriesService.update(businessId, id, dto, actorUserId);
  }

  @Delete(':id')
  @Permissions('finances.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RawResponse()
  @ApiOperation({
    summary:
      'Delete an expense category that has no expenses recorded under it',
  })
  async remove(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.categoriesService.remove(businessId, id, actorUserId);
  }
}
