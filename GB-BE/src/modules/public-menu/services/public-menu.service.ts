import { Product } from '../../products/domain/product.interface';
import { ProductMenuAvailability } from '../../products/domain/product.types';
import { Injectable } from '@nestjs/common';
import { BusinessesService } from '../../businesses/services/businesses.service';
import { ProductCategoriesService } from '../../product-categories/services/product-categories.service';
import { OptionGroupsService } from '../../option-groups/services/option-groups.service';
import { ProductsService } from '../../products/services/products.service';
import { BranchMenuService } from '../../products/services/branch-menu.service';
import { BranchesService } from '../../branches/services/branches.service';
import {
  PublicMenu,
  PublicMenuCategory,
  PublicMenuOptionGroup,
  PublicMenuProduct,
} from '../domain/public-menu.interface';

const UNCATEGORIZED_LABEL = 'Otros';

@Injectable()
export class PublicMenuService {
  constructor(
    private readonly businessesService: BusinessesService,
    private readonly productCategoriesService: ProductCategoriesService,
    private readonly productsService: ProductsService,
    private readonly optionGroupsService: OptionGroupsService,
    private readonly branchMenuService: BranchMenuService,
    private readonly branchesService: BranchesService,
  ) {}

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

    return {
      businessName: business.name,
      categories,
      builderCategories,
      optionGroups,
    };
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
