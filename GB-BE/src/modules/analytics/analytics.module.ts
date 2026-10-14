import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { AnalyticsController } from './controllers/analytics.controller';
import { AnalyticsService } from './services/analytics.service';

@Module({
  imports: [OrdersModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
