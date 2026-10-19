import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { DeliveriesController } from './controllers/deliveries.controller';
import { PublicDeliveryTrackingController } from './controllers/public-delivery-tracking.controller';
import { DeliveriesRepository } from './repositories/deliveries.repository';
import { DeliveryTrackingRepository } from './repositories/delivery-tracking.repository';
import { DeliveriesService } from './services/deliveries.service';
import { DeliveryLocationService } from './services/delivery-location.service';
import { DeliveryTrackingService } from './services/delivery-tracking.service';

@Module({
  imports: [AuditModule, PushNotificationsModule],
  controllers: [DeliveriesController, PublicDeliveryTrackingController],
  providers: [
    DeliveriesService,
    DeliveryLocationService,
    DeliveryTrackingService,
    DeliveriesRepository,
    DeliveryTrackingRepository,
  ],
})
export class DeliveriesModule {}
