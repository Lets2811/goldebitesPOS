import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module';
import { CashSessionsModule } from '../cash-sessions/cash-sessions.module';
import { InventoryMovementsModule } from '../inventory-movements/inventory-movements.module';
import { OrdersModule } from '../orders/orders.module';
import { DashboardController } from './controllers/dashboard.controller';
import { DashboardService } from './services/dashboard.service';

@Module({
  imports: [
    BusinessesModule,
    OrdersModule,
    InventoryMovementsModule,
    CashSessionsModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
