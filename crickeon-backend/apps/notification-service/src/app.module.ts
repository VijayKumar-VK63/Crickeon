import { Module } from '@nestjs/common';
import { NotificationGateway } from './notification/notification.gateway';
import { NotificationController } from './notification/notification.controller';
import { NotificationService } from './notification/notification.service';

@Module({
  providers: [NotificationGateway, NotificationService],
  controllers: [NotificationController]
})
export class AppModule {}
