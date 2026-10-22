import { Module } from '@nestjs/common';
import { PushNotificationsController } from './push-notifications.controller';
import { PushNotificationsRepository } from './push-notifications.repository';
import { PushNotificationsService } from './push-notifications.service';

@Module({
  controllers: [PushNotificationsController],
  providers: [PushNotificationsService, PushNotificationsRepository],
  exports: [PushNotificationsService],
})
export class PushNotificationsModule {}
