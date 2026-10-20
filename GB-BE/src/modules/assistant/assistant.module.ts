import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { BranchesModule } from '../branches/branches.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { InventoryMovementsModule } from '../inventory-movements/inventory-movements.module';
import { InventoryItemsModule } from '../inventory-items/inventory-items.module';
import { ProductsModule } from '../products/products.module';
import { RecipesModule } from '../recipes/recipes.module';
import { AssistantController } from './controllers/assistant.controller';
import { AssistantProductsService } from './services/assistant-products.service';
import { AssistantSalesService } from './services/assistant-sales.service';
import { AssistantInventoryService } from './services/assistant-inventory.service';
import { AssistantService } from './services/assistant.service';

@Module({
  imports: [
    ProductsModule,
    RecipesModule,
    InventoryMovementsModule,
    InventoryItemsModule,
    BranchesModule,
    AnalyticsModule,
    BusinessesModule,
  ],
  controllers: [AssistantController],
  providers: [
    AssistantService,
    AssistantProductsService,
    AssistantSalesService,
    AssistantInventoryService,
  ],
})
export class AssistantModule {}
