import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Put,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CreateProductCategoryDto } from '../dto/create-product-category.dto';
import { SetCategoryOrderDto } from '../dto/set-category-order.dto';
import { ProductCategoryQueryDto } from '../dto/product-category-query.dto';
import { SetProductCategoryStatusDto } from '../dto/set-product-category-status.dto';
import { UpdateProductCategoryDto } from '../dto/update-product-category.dto';
import { ProductCategoriesService } from '../services/product-categories.service';
import { RawResponse } from '../../../common/decorators/raw-response.decorator';
import { RequiresFeature } from '../../../common/decorators/requires-feature.decorator';

@ApiTags('Product Categories')
@ApiBearerAuth()
@RequiresFeature('products')
@Controller('product-categories')
export class ProductCategoriesController {
  constructor(private readonly categoriesService: ProductCategoriesService) {}

  @Post()
  @Permissions('products.create')
  @ApiOperation({ summary: 'Create a product category' })
  create(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Body() dto: CreateProductCategoryDto,
  ) {
    return this.categoriesService.create({ businessId, ...dto }, actorUserId);
  }

  @Get()
  @Permissions('products.read')
  @ApiOperation({ summary: 'List product categories for the current business' })
  findAll(
    @CurrentBusiness() businessId: string,
    @Query() query: ProductCategoryQueryDto,
  ) {
    return this.categoriesService.findAll({
      businessId,
      page: query.page,
      limit: query.limit,
      isActive: query.isActive,
      search: query.search,
    });
  }

  // Before the ":id" routes so "order" is never read as an id.
  @Put('order')
  @Permissions('products.update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RawResponse()
  @ApiOperation({ summary: 'Set the order of the sections customers see, in the menu or in "Arma tu combo"' })
  async setOrder(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Body() dto: SetCategoryOrderDto,
  ) {
    await this.categoriesService.setOrder(businessId, dto.scope, dto.categoryIds, actorUserId);
  }

  @Get(':id')
  @Permissions('products.read')
  @ApiOperation({ summary: 'Get a single product category' })
  findOne(@CurrentBusiness() businessId: string, @Param('id') id: string) {
    return this.categoriesService.findOne(businessId, id);
  }

  @Patch(':id')
  @Permissions('products.update')
  @ApiOperation({
    summary: 'Update a product category (name, description, display order)',
  })
  update(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductCategoryDto,
  ) {
    return this.categoriesService.update(businessId, id, dto, actorUserId);
  }

  @Patch(':id/status')
  @Permissions('products.update')
  @ApiOperation({ summary: 'Activate or deactivate a product category' })
  setStatus(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
    @Body() dto: SetProductCategoryStatusDto,
  ) {
    return this.categoriesService.setActive(
      businessId,
      id,
      dto.isActive,
      actorUserId,
    );
  }
}
