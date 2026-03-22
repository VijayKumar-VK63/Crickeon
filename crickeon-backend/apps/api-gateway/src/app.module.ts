import { Module } from '@nestjs/common';
import { GatewayController } from './gateway.controller';
import { RateLimitGuard } from './common/rate-limit.guard';
import { RolesGuard } from './common/roles.guard';
import { RealtimeGateway } from './realtime/realtime.gateway';

@Module({
  controllers: [GatewayController],
  providers: [RateLimitGuard, RolesGuard, RealtimeGateway]
})
export class AppModule {}
