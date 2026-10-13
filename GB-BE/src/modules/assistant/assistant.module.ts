import { Module } from '@nestjs/common';
import { BranchesModule } from '../branches/branches.module';
import { InventoryMovementsModule } from '../inventory-movements/inventory-movements.module';
import { ProductsModule } from '../products/products.module';
import { RecipesModule } from '../recipes/recipes.module';
import { AssistantController } from './controllers/assistant.controller';
import { AssistantProductsService } from './services/assistant-products.service';
import { AssistantService } from './services/assistant.service';

@Module({
  imports: [
    ProductsModule,
    RecipesModule,
    InventoryMovementsModule,
    BranchesModule,
  ],
  controllers: [AssistantController],
  providers: [AssistantService, AssistantProductsService],
})
export class AssistantModule {}
