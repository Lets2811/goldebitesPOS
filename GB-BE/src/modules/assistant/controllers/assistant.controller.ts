import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { RequiresFeature } from '../../../common/decorators/requires-feature.decorator';
import { BRANCH_SWITCH_PERMISSION } from '../../../common/guards/branch-scope.guard';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface';
import { AssistantProductsQueryDto } from '../dto/assistant-products-query.dto';
import { AssistantSalesQueryDto } from '../dto/assistant-sales-query.dto';
import { AssistantInventoryQueryDto } from '../dto/assistant-inventory-query.dto';
import { AssistantBranchComparisonQueryDto } from '../dto/assistant-branch-comparison-query.dto';
import { AssistantBranchComparisonService } from '../services/assistant-branch-comparison.service';
import { AssistantInventoryService } from '../services/assistant-inventory.service';
import {
  AssistantBranchScopeService,
  ResolvedBranchScope,
} from '../services/assistant-branch-scope.service';
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
    private readonly assistantInventoryService: AssistantInventoryService,
    private readonly branchScope: AssistantBranchScopeService,
    private readonly branchComparison: AssistantBranchComparisonService,
  ) {}

  /** The branch a question is about, as the list endpoints take it. */
  private async listScope(
    businessId: string,
    user: AuthenticatedUser,
    branchName: string | undefined,
  ) {
    const resolved: ResolvedBranchScope = await this.branchScope.resolve(
      businessId,
      user,
      branchName,
    );
    return {
      branchId: resolved.branchId ?? null,
      labelBranches: !resolved.single && !resolved.scope.branch,
      branchNames: resolved.namesById,
      scope: resolved.scope,
    };
  }

  /** A user tied to a branch, without branches.switch: what they may read is that branch's. */
  private static ownBranchOnly(user: AuthenticatedUser): string | null {
    return user.branchId && !user.permissions.includes(BRANCH_SWITCH_PERMISSION)
      ? user.branchId
      : null;
  }

  @Get('branches')
  @ApiOperation({
    summary:
      'The branches the caller can ask about: their own, and every active one when they may see them all',
  })
  async findBranches(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { scope, namesById, single, active } = await this.branchScope.resolve(
      businessId,
      user,
      undefined,
    );
    const own = user.branchId
      ? { id: user.branchId, name: namesById.get(user.branchId) ?? '' }
      : null;
    // Several branches and the caller may see them all; otherwise theirs, or none to tell apart.
    const canSeeAll = !single && Boolean(scope.branches);
    return {
      ownBranch: own,
      canSeeAll,
      branches: canSeeAll ? active : own ? [own] : [],
    };
  }

  @Get('inventory')
  @RequiresFeature(INVENTORY_FEATURE)
  @Permissions(INVENTORY_PERMISSION)
  @ApiOperation({
    summary:
      'Search inventory items of one branch or of every branch the caller may see, with their stock and whether they run below their minimum',
  })
  async findInventory(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AssistantInventoryQueryDto,
  ) {
    return this.assistantInventoryService.search({
      businessId,
      ...(await this.listScope(businessId, user, query.branch)),
      search: query.search?.trim() || undefined,
      isActive: query.isActive,
      limit: query.limit,
    });
  }

  @Get('inventory/:id')
  @RequiresFeature(INVENTORY_FEATURE)
  @Permissions(INVENTORY_PERMISSION)
  @ApiOperation({ summary: 'One inventory item, with its stock at its branch' })
  findInventoryItem(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.assistantInventoryService.findOne(
      businessId,
      id,
      AssistantController.ownBranchOnly(user),
    );
  }

  @Get('products')
  @RequiresFeature('products')
  @Permissions('products.read')
  @ApiOperation({
    summary:
      'Search products, with the current stock of those sold straight from one inventory item; optionally ranked by that stock',
  })
  async findProducts(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AssistantProductsQueryDto,
  ) {
    return this.assistantProductsService.search({
      businessId,
      ...(await this.listScope(businessId, user, query.branch)),
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
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AssistantSalesQueryDto,
  ) {
    return this.assistantSalesService.getSales({
      businessId,
      user,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      branchName: query.branch,
      groupBy: query.groupBy,
      includeTopProducts: query.includeTopProducts,
      topProductsLimit: query.topProductsLimit,
      topProductsOrder: query.topProductsOrder,
    });
  }

  @Get('branch-comparison')
  @RequiresFeature('analytics')
  @Permissions('analytics.read', BRANCH_SWITCH_PERMISSION)
  @ApiOperation({
    summary:
      'Every branch side by side for a range of calendar days: sales, orders, ticket, discounts, expenses, waste',
  })
  compareBranches(
    @CurrentBusiness() businessId: string,
    @Query() query: AssistantBranchComparisonQueryDto,
  ) {
    return this.branchComparison.compare(
      businessId,
      query.dateFrom,
      query.dateTo,
    );
  }
}
