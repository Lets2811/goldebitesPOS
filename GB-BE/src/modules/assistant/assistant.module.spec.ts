import { MODULE_METADATA } from '@nestjs/common/constants';
import { AssistantModule } from './assistant.module';
import { AssistantController } from './controllers/assistant.controller';
import { AssistantProductsService } from './services/assistant-products.service';
import { AssistantInventoryService } from './services/assistant-inventory.service';
import { AssistantSalesService } from './services/assistant-sales.service';
import { AssistantService } from './services/assistant.service';

describe('AssistantModule', () => {
  it('exposes the assistant controller', () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AssistantModule),
    ).toEqual([AssistantController]);
  });

  it('provides its own services and no data access of its own', () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AssistantModule),
    ).toEqual([
      AssistantService,
      AssistantProductsService,
      AssistantSalesService,
      AssistantInventoryService,
    ]);
  });
});
