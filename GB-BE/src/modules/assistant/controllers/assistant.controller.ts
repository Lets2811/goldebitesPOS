import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { RequiresFeature } from '../../../common/decorators/requires-feature.decorator';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface';
import { AssistantProductsQueryDto } from '../dto/assistant-products-query.dto';
import { AssistantSalesQueryDto } from '../dto/assistant-sales-query.dto';
import { AssistantProductsService } from '../services/assistant-products.service';
import { AssistantSalesService } from '../services/assistant-sales.service';
import { AssistantService } from '../services/assistant.service';

/** What the inventory endpoints themselves ask for; stock is only shown to a caller who could read it there. */
const INVENTORY_PERMISSION = 'inventory.read';
const INVENTORY_FEATURE = 'inventory';

/**
 * The POS endpoints an external assistant consumes. They sit behind the same
 * authentication and permissions as the rest of the API, and reuse the
 * existing services — nothing here reaches the database on its own.
 */
@ApiTags('Assistant')
@ApiBearerAuth()
@Controller('assistant')
export class AssistantController {
  constructor(
    private readonly assistantService: AssistantService,
    private readonly assistantProductsService: AssistantProductsService,
    private readonly assistantSalesService: AssistantSalesService,
  ) {}

  @Get('products')
  @RequiresFeature('products')
  @Permissions('products.read')
  @ApiOperation({
    summary:
      'Search products, with the current stock of those sold straight from one inventory item; optionally ranked by that stock',
  })
  findProducts(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AssistantProductsQueryDto,
  ) {
    return this.assistantProductsService.search({
      businessId,
      branchId: user.branchId,
      canReadStock:
        user.permissions.includes(INVENTORY_PERMISSION) &&
        Boolean(user.enabledFeatures?.includes(INVENTORY_FEATURE)),
      search: query.search?.trim() || undefined,
      isActive: query.isActive,
      isVisible: query.isVisible,
      limit: query.limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });
  }

  @Get('sales')
  @RequiresFeature('analytics')
  @Permissions('analytics.read')
  @ApiOperation({
    summary:
      'Sales of a range of calendar days: the total, and on request its breakdown over time and the best-selling products',
  })
  getSales(
    @CurrentBusiness() businessId: string,
    @Query() query: AssistantSalesQueryDto,
  ) {
    return this.assistantSalesService.getSales({
      businessId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      branchName: query.branch,
      groupBy: query.groupBy,
      includeTopProducts: query.includeTopProducts,
      topProductsLimit: query.topProductsLimit,
      topProductsOrder: query.topProductsOrder,
    });
  }
}
