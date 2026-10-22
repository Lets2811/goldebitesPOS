import { DiscountsModule } from '../discounts/discounts.module';
import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BranchesModule } from '../branches/branches.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { CustomersModule } from '../customers/customers.module';
import { InventoryMovementsModule } from '../inventory-movements/inventory-movements.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { ProductsModule } from '../products/products.module';
import { RecipesModule } from '../recipes/recipes.module';
import { OptionGroupsModule } from '../option-groups/option-groups.module';
import { OrdersController } from './controllers/orders.controller';
import { OrdersRepository } from './repositories/orders.repository';
import { ORDERS_REPOSITORY } from './repositories/orders.repository.interface';
import { OrdersService } from './services/orders.service';

@Module({
  imports: [
    BranchesModule,
    ProductsModule,
    RecipesModule,
    CustomersModule,
    InventoryMovementsModule,
    BusinessesModule,
    LoyaltyModule,
    OptionGroupsModule,
    AuditModule,
    DiscountsModule,
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    { provide: ORDERS_REPOSITORY, useClass: OrdersRepository },
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
