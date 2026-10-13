import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import { validate } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { FeaturesGuard } from './common/guards/features.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { MustChangePasswordGuard } from './common/guards/must-change-password.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { PlatformAdminGuard } from './common/guards/platform-admin.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AssistantModule } from './modules/assistant/assistant.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { BranchesModule } from './modules/branches/branches.module';
import { BusinessFeaturesModule } from './modules/business-features/business-features.module';
import { BusinessesModule } from './modules/businesses/businesses.module';
import { CashSessionsModule } from './modules/cash-sessions/cash-sessions.module';
import { ChecklistsModule } from './modules/checklists/checklists.module';
import { CustomersModule } from './modules/customers/customers.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DocumentScansModule } from './modules/document-scans/document-scans.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { FinancesModule } from './modules/finances/finances.module';
import { FundsModule } from './modules/funds/funds.module';
import { GoodsReceiptsModule } from './modules/goods-receipts/goods-receipts.module';
import { HealthModule } from './modules/health/health.module';
import { HrModule } from './modules/hr/hr.module';
import { InventoryCountsModule } from './modules/inventory-counts/inventory-counts.module';
import { InventoryItemCategoriesModule } from './modules/inventory-item-categories/inventory-item-categories.module';
import { InventoryItemsModule } from './modules/inventory-items/inventory-items.module';
import { InventoryLocationsModule } from './modules/inventory-locations/inventory-locations.module';
import { InventoryMovementsModule } from './modules/inventory-movements/inventory-movements.module';
import { InventoryTransfersModule } from './modules/inventory-transfers/inventory-transfers.module';
import { KitchenModule } from './modules/kitchen/kitchen.module';
import { LoyaltyModule } from './modules/loyalty/loyalty.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { MarketingModule } from './modules/marketing/marketing.module';
import { NfcTagsModule } from './modules/nfc-tags/nfc-tags.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { PlatformAdminModule } from './modules/platform-admin/platform-admin.module';
import { ProductCategoriesModule } from './modules/product-categories/product-categories.module';
import { ProductsModule } from './modules/products/products.module';
import { PublicMenuModule } from './modules/public-menu/public-menu.module';
import { PublicNfcOrdersModule } from './modules/public-nfc-orders/public-nfc-orders.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { RecipesModule } from './modules/recipes/recipes.module';
import { RolesModule } from './modules/roles/roles.module';
import { SaucesModule } from './modules/sauces/sauces.module';
import { SettingsModule } from './modules/settings/settings.module';
import { SidesModule } from './modules/sides/sides.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { TableNamesModule } from './modules/table-names/table-names.module';
import { TuraLinksModule } from './modules/tura-links/tura-links.module';
import { TabletKioskModule } from './modules/tablet-kiosk/tablet-kiosk.module';
import { UsersModule } from './modules/users/users.module';
import { WasteModule } from './modules/waste/waste.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      load: [appConfig, databaseConfig],
    }),
    // Per IP, and every device of a restaurant (the orders screen, each
    // waiter tablet, the kitchen) shares one public IP while polling. The
    // limit has to fit a whole venue; endpoints that need a tight one (login,
    // password reset) set their own with @Throttle.
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 600,
      },
    ]),
    DatabaseModule,
    HealthModule,
    AuditModule,
    PermissionsModule,
    RolesModule,
    BusinessesModule,
    BranchesModule,
    UsersModule,
    AuthModule,
    ProductCategoriesModule,
    ProductsModule,
    SaucesModule,
    SidesModule,
    SuppliersModule,
    TableNamesModule,
    TuraLinksModule,
    InventoryItemCategoriesModule,
    InventoryItemsModule,
    RecipesModule,
    InventoryLocationsModule,
    InventoryMovementsModule,
    InventoryTransfersModule,
    InventoryCountsModule,
    PurchasesModule,
    GoodsReceiptsModule,
    CustomersModule,
    CashSessionsModule,
    OrdersModule,
    KitchenModule,
    PaymentsModule,
    WasteModule,
    SettingsModule,
    DashboardModule,
    AnalyticsModule,
    EmployeesModule,
    HrModule,
    ChecklistsModule,
    MaintenanceModule,
    LoyaltyModule,
    MarketingModule,
    DocumentsModule,
    DocumentScansModule,
    BusinessFeaturesModule,
    PlatformAdminModule,
    FinancesModule,
    FundsModule,
    NfcTagsModule,
    TabletKioskModule,
    PublicMenuModule,
    PublicNfcOrdersModule,
    AssistantModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: MustChangePasswordGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: FeaturesGuard },
    { provide: APP_GUARD, useClass: PlatformAdminGuard },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
