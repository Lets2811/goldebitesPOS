import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { InventoryItemsController } from './controllers/inventory-items.controller';
import { InventoryQueriesController } from './controllers/inventory-queries.controller';
import { InventoryQueryTemplatesController } from './controllers/inventory-query-templates.controller';
import { InventoryItemsRepository } from './repositories/inventory-items.repository';
import { INVENTORY_ITEMS_REPOSITORY } from './repositories/inventory-items.repository.interface';
import { InventoryQueryTemplatesRepository } from './repositories/inventory-query-templates.repository';
import { INVENTORY_QUERY_TEMPLATES_REPOSITORY } from './repositories/inventory-query-templates.repository.interface';
import { InventoryItemsService } from './services/inventory-items.service';
import { InventoryQueriesService } from './services/inventory-queries.service';
import { InventoryItemBranchesService } from './services/inventory-item-branches.service';

@Module({
  imports: [AuditModule],
  controllers: [
    InventoryItemsController,
    InventoryQueriesController,
    InventoryQueryTemplatesController,
  ],
  providers: [
    InventoryItemsService,
    InventoryQueriesService,
    InventoryItemBranchesService,
    { provide: INVENTORY_ITEMS_REPOSITORY, useClass: InventoryItemsRepository },
    {
      provide: INVENTORY_QUERY_TEMPLATES_REPOSITORY,
      useClass: InventoryQueryTemplatesRepository,
    },
  ],
  exports: [InventoryItemsService, INVENTORY_ITEMS_REPOSITORY],
})
export class InventoryItemsModule {}
