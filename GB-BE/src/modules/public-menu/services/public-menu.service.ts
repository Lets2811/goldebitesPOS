import { Product } from '../../products/domain/product.interface';
import { ProductMenuAvailability } from '../../products/domain/product.types';
import { Injectable } from '@nestjs/common';
import { BusinessesService } from '../../businesses/services/businesses.service';
import { ProductCategoriesService } from '../../product-categories/services/product-categories.service';
import { OptionGroupsService } from '../../option-groups/services/option-groups.service';
import { ProductsService } from '../../products/services/products.service';
import { BranchMenuService } from '../../products/services/branch-menu.service';
import { BranchesService } from '../../branches/services/branches.service';
import { OrdersService } from '../../orders/services/orders.service';
import {
  addDays,
  businessDayRange,
  businessToday,
} from '../../../common/utils/business-day.util';
import {
  PublicMenu,
  PublicMenuCategory,
  PublicMenuOptionGroup,
  PublicMenuProduct,
  PublicMenuTopSellers,
} from '../domain/public-menu.interface';

const UNCATEGORIZED_LABEL = 'Otros';
/** What "Arma tu combo" is called, and says, until the business names it its own way. */
export const DEFAULT_BUILDER_NAME = 'Arma tu combo';
export const DEFAULT_BUILDER_DESCRIPTION =
  'Escoge lo que quieras, a tu gusto y a tu estilo.';

/** How many best sellers the menu shows. */
const TOP_SELLERS_SHOWN = 5;
/** Below this many orders today, the day says too little: yesterday's are shown. */
const TOP_SELLERS_MIN_TODAY_ORDERS = 5;
/** Every customer opening the menu would count the day's orders again: it is kept this long. */
const TOP_SELLERS_CACHE_MS = 60_000;

@Injectable()
export class PublicMenuService {
  constructor(
    private readonly businessesService: BusinessesService,
    private readonly productCategoriesService: ProductCategoriesService,
    private readonly productsService: ProductsService,
    private readonly optionGroupsService: OptionGroupsService,
    private readonly branchMenuService: BranchMenuService,
    private readonly branchesService: BranchesService,
    private readonly ordersService: OrdersService,
  ) {}

  /** The best sellers by business and branch, for a minute (see TOP_SELLERS_CACHE_MS). */
  private readonly topSellersCache = new Map<
    string,
    {
      at: number;
      value: { period: 'TODAY' | 'RECENT'; productIds: string[] }[];
    }
  >();

  /**
   * Live, always-current menu (no "generate" step) — reflects whatever
   * products/categories are active right now. No @Permissions()/@RequiresFeature()
   * here: this endpoint is @Public(), there's no request.user to check them against.
   * Filters on isVisible in addition to isActive: some active products (e.g.
   * internal surcharges the team adds when invoicing) stay usable for staff
   * but are deliberately hidden from this customer-facing view.
   *
   * Option groups ("Salsas", "Tamaño"...) are returned once, business-wide,
   * with their active options — not duplicated per product. Each product only
   * carries which of them it offers and how many can be picked. A group that's
   * off or has nothing active to pick is left out everywhere.
   */
  async getMenu(businessId: string, branchId?: string): Promise<PublicMenu> {
    const business = await this.businessesService.findById(businessId);
    // The branch's own menu: the table's (NFC), the one in the link, or the
    // business's first branch when none is given.
    const branch =
      branchId &&
      (await this.branchesService.isActiveBranch(businessId, branchId))
        ? branchId
        : await this.branchesService.firstActiveBranchId(businessId);

    const [categoriesResult, productsResult, allGroups, branchMenu] =
      await Promise.all([
        this.productCategoriesService.findAll({
          businessId,
          isActive: true,
          page: 1,
          limit: 200,
        }),
        this.productsService.findAll({
          businessId,
          branchId: branch ?? undefined,
          isActive: true,
          isVisible: true,
          page: 1,
          limit: 500,
        }),
        this.optionGroupsService.findAll(businessId),
        this.branchMenuService.forBranch(businessId, branch),
      ]);
    // What ran out (no stock for its recipe) isn't on the menu.
    const sellable = productsResult.data.filter(
      (product) => !branchMenu.get(product.id)?.outOfStock,
    );
    const optionGroups: PublicMenuOptionGroup[] = allGroups
      .filter((group) => group.isActive)
      .map((group) => ({
        id: group.id,
        name: group.name,
        singularName: group.singularName,
        isRequired: group.isRequired,
        items: group.items
          .filter((item) => item.isActive)
          .map((item) => ({ id: item.id, name: item.name })),
      }))
      .filter((group) => group.items.length > 0);
    const offerable = new Set(optionGroups.map((group) => group.id));

    const inMenu = sellable.filter(
      (p) => p.menuAvailability !== ProductMenuAvailability.BUILDER,
    );
    const inBuilder = sellable.filter(
      (p) => p.menuAvailability !== ProductMenuAvailability.MENU,
    );
    const categories = this.groupByCategory(
      inMenu,
      categoriesResult.data,
      offerable,
    );
    // "Arma tu combo" has its own section order; the regular menu keeps display_order (the list's own order).
    const builderOrder = [...categoriesResult.data].sort(
      (a, b) =>
        a.builderDisplayOrder - b.builderDisplayOrder ||
        a.name.localeCompare(b.name),
    );
    const builderCategories = this.groupByCategory(
      inBuilder,
      builderOrder,
      offerable,
    );

    const topSellers = business.menuTopSellers
      ? await this.topSellers(
          businessId,
          branch ?? undefined,
          business.timezone,
          new Set(inMenu.map((product) => product.id)),
        )
      : null;

    return {
      businessName: business.name,
      topSellers,
      categories,
      builderCategories,
      builderName: business.comboBuilderName ?? DEFAULT_BUILDER_NAME,
      builderDescription:
        business.comboBuilderDescription ?? DEFAULT_BUILDER_DESCRIPTION,
      hasBuilderTemplate: business.hasComboBuilderTemplate ?? false,
      optionGroups,
    };
  }

  /**
   * The branch's most ordered products on the menu: today's once the day has
   * enough orders, yesterday's until then, and today's few if yesterday had
   * none (a day the place was closed). What counts is what customers ordered,
   * paid or not (orders not cancelled, by when they were taken), by units:
   * many places charge at the end. Only products that can be ordered now
   * count: one that ran out, was hidden or is only for "Arma tu combo" is
   * skipped.
   */
  private async topSellers(
    businessId: string,
    branchId: string | undefined,
    timezone: string,
    orderable: Set<string>,
  ): Promise<PublicMenuTopSellers | null> {
    const candidates = await this.rankedDays(businessId, branchId, timezone);
    for (const candidate of candidates) {
      const productIds = candidate.productIds
        .filter((id) => orderable.has(id))
        .slice(0, TOP_SELLERS_SHOWN);
      if (productIds.length > 0) {
        return { period: candidate.period, productIds };
      }
    }
    return null;
  }

  /** The rankings to try, in order: today's (with enough sales), yesterday's, today's anyway. */
  private async rankedDays(
    businessId: string,
    branchId: string | undefined,
    timezone: string,
  ): Promise<{ period: 'TODAY' | 'RECENT'; productIds: string[] }[]> {
    const key = `${businessId}:${branchId ?? ''}`;
    const cached = this.topSellersCache.get(key);
    if (cached && Date.now() - cached.at < TOP_SELLERS_CACHE_MS) {
      return cached.value;
    }
    const today = businessToday(timezone);
    const yesterday = addDays(today, -1);
    const todayRange = businessDayRange(today, today, timezone);
    const yesterdayRange = businessDayRange(yesterday, yesterday, timezone);
    // More than shown: some may not be orderable right now.
    const depth = TOP_SELLERS_SHOWN * 3;
    const [todayOrdered, yesterdayOrdered] = await Promise.all([
      this.ordersService.getMostOrdered(
        businessId,
        branchId,
        todayRange.dateFrom,
        todayRange.dateTo,
        depth,
      ),
      this.ordersService.getMostOrdered(
        businessId,
        branchId,
        yesterdayRange.dateFrom,
        yesterdayRange.dateTo,
        depth,
      ),
    ]);
    const todayRanking = {
      period: 'TODAY' as const,
      productIds: todayOrdered.productIds,
    };
    const value: { period: 'TODAY' | 'RECENT'; productIds: string[] }[] =
      todayOrdered.orderCount >= TOP_SELLERS_MIN_TODAY_ORDERS
        ? [todayRanking]
        : [
            { period: 'RECENT', productIds: yesterdayOrdered.productIds },
            todayRanking,
          ];
    this.topSellersCache.set(key, { at: Date.now(), value });
    return value;
  }

  /** The business's own template for "Arma tu combo", or null (the default view). */
  async getBuilderTemplate(businessId: string): Promise<string | null> {
    return this.businessesService.getComboBuilderTemplate(businessId);
  }

  /** Products into their categories (in the categories' display order), plus "Otros" for the uncategorized. */
  private groupByCategory(
    products: Product[],
    orderedCategories: { id: string; name: string }[],
    offerable: Set<string>,
  ): PublicMenuCategory[] {
    const productsByCategory = new Map<string | null, PublicMenuProduct[]>();
    for (const product of products) {
      const key = product.categoryId;
      const list = productsByCategory.get(key) ?? [];
      list.push({
        id: product.id,
        name: product.name,
        salePrice: product.salePrice,
        description: product.description,
        imageUrl: product.imageUrl,
        optionGroups: product.optionGroups.filter((offered) =>
          offerable.has(offered.groupId),
        ),
      });
      productsByCategory.set(key, list);
    }
    for (const list of productsByCategory.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    // The categories come already ordered by display_order, name.
    const categories: PublicMenuCategory[] = orderedCategories
      .map((category) => ({
        id: category.id,
        name: category.name,
        products: productsByCategory.get(category.id) ?? [],
      }))
      .filter((category) => category.products.length > 0);

    const uncategorized = productsByCategory.get(null) ?? [];
    if (uncategorized.length > 0) {
      categories.push({
        id: null,
        name: UNCATEGORIZED_LABEL,
        products: uncategorized,
      });
    }

    return categories;
  }
}
