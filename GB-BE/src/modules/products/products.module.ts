import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ProductCategoriesModule } from '../product-categories/product-categories.module';
import { OptionGroupsModule } from '../option-groups/option-groups.module';
import { ProductsController } from './controllers/products.controller';
import { PublicProductImagesController } from './controllers/public-product-images.controller';
import { ProductsRepository } from './repositories/products.repository';
import { PRODUCTS_REPOSITORY } from './repositories/products.repository.interface';
import { ProductsService } from './services/products.service';

@Module({
  imports: [ProductCategoriesModule, OptionGroupsModule, AuditModule],
  controllers: [ProductsController, PublicProductImagesController],
  providers: [
    ProductsService,
    { provide: PRODUCTS_REPOSITORY, useClass: ProductsRepository },
  ],
  exports: [ProductsService, PRODUCTS_REPOSITORY],
})
export class ProductsModule {}
