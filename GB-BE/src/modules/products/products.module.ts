import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ProductCategoriesModule } from '../product-categories/product-categories.module';
import { OptionGroupsModule } from '../option-groups/option-groups.module';
import { ProductsController } from './controllers/products.controller';
import { PublicProductImagesController } from './controllers/public-product-images.controller';
import { ProductsRepository } from './repositories/products.repository';
import { PRODUCTS_REPOSITORY } from './repositories/products.repository.interface';
import { ProductsService } from './services/products.service';
import { BranchMenuService } from './services/branch-menu.service';
import { BranchMenuRepository } from './repositories/branch-menu.repository';

@Module({
  imports: [ProductCategoriesModule, OptionGroupsModule, AuditModule],
  controllers: [ProductsController, PublicProductImagesController],
  providers: [
    ProductsService,
    BranchMenuService,
    BranchMenuRepository,
    { provide: PRODUCTS_REPOSITORY, useClass: ProductsRepository },
  ],
  exports: [ProductsService, BranchMenuService, PRODUCTS_REPOSITORY],
})
export class ProductsModule {}
