import { Module } from '@nestjs/common';
import { BranchesModule } from '../branches/branches.module';
import { InventoryItemsModule } from '../inventory-items/inventory-items.module';
import { ProductsModule } from '../products/products.module';
import { RecipesModule } from '../recipes/recipes.module';
import { BranchCatalogController } from './branch-catalog.controller';
import { BranchCatalogService } from './branch-catalog.service';

/** Bringing a product from one branch's catalog to another's. */
@Module({
  imports: [
    ProductsModule,
    InventoryItemsModule,
    RecipesModule,
    BranchesModule,
  ],
  controllers: [BranchCatalogController],
  providers: [BranchCatalogService],
})
export class BranchCatalogModule {}
