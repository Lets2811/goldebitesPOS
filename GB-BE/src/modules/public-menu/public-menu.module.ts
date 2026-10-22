import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module';
import { ProductCategoriesModule } from '../product-categories/product-categories.module';
import { OptionGroupsModule } from '../option-groups/option-groups.module';
import { ProductsModule } from '../products/products.module';
import { BranchesModule } from '../branches/branches.module';
import { OrdersModule } from '../orders/orders.module';
import { PublicMenuController } from './controllers/public-menu.controller';
import { PublicMenuService } from './services/public-menu.service';

@Module({
  imports: [
    BusinessesModule,
    ProductCategoriesModule,
    ProductsModule,
    OptionGroupsModule,
    BranchesModule,
    OrdersModule,
  ],
  controllers: [PublicMenuController],
  providers: [PublicMenuService],
})
export class PublicMenuModule {}
