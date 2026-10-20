import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import {
  BadRequestException,
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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { RawResponse } from '../../../common/decorators/raw-response.decorator';
import { CreateProductDto } from '../dto/create-product.dto';
import { ProductQueryDto } from '../dto/product-query.dto';
import { SetProductStatusDto } from '../dto/set-product-status.dto';
import { SetProductVisibilityDto } from '../dto/set-product-visibility.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { ProductsService } from '../services/products.service';
import { BranchMenuService } from '../services/branch-menu.service';
import {
  BranchMenuQueryDto,
  SetProductBranchDto,
} from '../dto/branch-menu.dto';
import {
  ALLOWED_PRODUCT_IMAGE_MIME_TYPES,
  MAX_PRODUCT_IMAGE_SIZE_BYTES,
  PRODUCT_IMAGES_UPLOADS_DIR,
  ensureProductImagesUploadsDir,
} from '../storage/product-image-storage.util';

ensureProductImagesUploadsDir();
import { RequiresFeature } from '../../../common/decorators/requires-feature.decorator';

@ApiTags('Products')
@ApiBearerAuth()
@RequiresFeature('products')
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly branchMenuService: BranchMenuService,
  ) {}

  @Post()
  @Permissions('products.create')
  @ApiOperation({ summary: 'Create a product' })
  create(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Body() dto: CreateProductDto,
  ) {
    return this.productsService.create({ businessId, ...dto }, actorUserId);
  }

  @Get()
  @Permissions('products.read')
  @ApiOperation({ summary: 'List products for the current business' })
  findAll(
    @CurrentBusiness() businessId: string,
    @Query() query: ProductQueryDto,
  ) {
    return this.productsService.findAll({
      businessId,
      page: query.page,
      limit: query.limit,
      categoryId: query.categoryId,
      isActive: query.isActive,
      isVisible: query.isVisible,
      search: query.search,
    });
  }

  @Get('available')
  @Permissions('products.read')
  @ApiOperation({
    summary: 'List products available for sale (active, not deleted)',
  })
  findAvailableForSale(@CurrentBusiness() businessId: string) {
    return this.productsService.findAvailableForSale(businessId);
  }

  @Get('menu')
  @Permissions('products.read')
  @ApiOperation({
    summary:
      'What a branch sells: the active products it offers, at its prices, and which ran out there',
  })
  getBranchMenu(
    @CurrentBusiness() businessId: string,
    @Query() query: BranchMenuQueryDto,
  ) {
    return this.branchMenuService.sellingMenu(
      businessId,
      query.branchId ?? null,
    );
  }

  @Get(':id/branches')
  @Permissions('products.read')
  @ApiOperation({
    summary:
      'How a product sells at each branch: offered or not, its price there, sold out',
  })
  getProductBranches(
    @CurrentBusiness() businessId: string,
    @Param('id') id: string,
  ) {
    return this.branchMenuService.productBranches(businessId, id);
  }

  @Put(':id/branches/:branchId')
  @Permissions('products.update')
  @ApiOperation({
    summary: "Leave a product out of a branch's menu, or set its price there",
  })
  setProductBranch(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
    @Param('branchId') branchId: string,
    @Body() dto: SetProductBranchDto,
  ) {
    return this.branchMenuService.setProductBranch(
      businessId,
      id,
      branchId,
      { isAvailable: dto.isAvailable, salePrice: dto.salePrice ?? null },
      actorUserId,
    );
  }

  @Get(':id')
  @Permissions('products.read')
  @ApiOperation({ summary: 'Get a single product' })
  findOne(@CurrentBusiness() businessId: string, @Param('id') id: string) {
    return this.productsService.findOne(businessId, id);
  }

  @Get(':id/margin')
  @Permissions('products.read')
  @ApiOperation({ summary: 'Get the sale price / cost margin for a product' })
  getMargin(@CurrentBusiness() businessId: string, @Param('id') id: string) {
    return this.productsService.getMargin(businessId, id);
  }

  @Patch(':id')
  @Permissions('products.update')
  @ApiOperation({ summary: 'Update a product' })
  update(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(businessId, id, dto, actorUserId);
  }

  @Patch(':id/status')
  @Permissions('products.update')
  @ApiOperation({ summary: 'Activate or deactivate a product' })
  setStatus(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
    @Body() dto: SetProductStatusDto,
  ) {
    return this.productsService.setActive(
      businessId,
      id,
      dto.isActive,
      actorUserId,
    );
  }

  @Patch(':id/visibility')
  @Permissions('products.update')
  @ApiOperation({
    summary:
      'Show or hide a product on customer-facing surfaces like the public menu',
  })
  setVisibility(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
    @Body() dto: SetProductVisibilityDto,
  ) {
    return this.productsService.setVisible(
      businessId,
      id,
      dto.isVisible,
      actorUserId,
    );
  }

  @Delete(':id')
  @Permissions('products.update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RawResponse()
  @ApiOperation({ summary: 'Soft delete a product' })
  async remove(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
  ) {
    await this.productsService.softDelete(businessId, id, actorUserId);
  }

  @Post(':id/image')
  @Permissions('products.update')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: "Upload the product's photo (replaces the current one)",
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: PRODUCT_IMAGES_UPLOADS_DIR,
        filename: (_req, file, cb) => {
          cb(null, `${randomUUID()}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: MAX_PRODUCT_IMAGE_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_PRODUCT_IMAGE_MIME_TYPES.includes(file.mimetype)) {
          cb(
            new BadRequestException(
              'Solo se permiten imágenes JPG, PNG o WEBP.',
            ),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadImage(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        'Debes adjuntar una imagen (JPG, PNG o WEBP).',
      );
    }
    return this.productsService.setImage(
      businessId,
      id,
      file.path,
      file.mimetype,
      actorUserId,
    );
  }

  @Delete(':id/image')
  @Permissions('products.update')
  @ApiOperation({ summary: "Remove the product's photo" })
  removeImage(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
  ) {
    return this.productsService.clearImage(businessId, id, actorUserId);
  }
}
