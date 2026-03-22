import { Body, Controller, Get, Post } from '@nestjs/common';
import { NotificationGateway } from './notification.gateway';
import { NotificationService } from './notification.service';

@Controller()
export class NotificationController {
  constructor(
    private readonly gateway: NotificationGateway,
    private readonly notificationService: NotificationService
  ) {}

  @Get('health')
  health() {
    return { service: 'notification-service', status: 'ok', ts: new Date().toISOString() };
  }

  @Post('notify')
  notify(@Body() dto: { roomId: string; event: string; payload: unknown }) {
    this.gateway.publishRoomEvent(dto.roomId, dto.event, dto.payload);
    return { delivered: true };
  }

  @Post('notify/email')
  email(@Body() dto: { to: string; subject: string; html: string }) {
    return this.notificationService.sendEmail(dto);
  }

  @Post('notify/push')
  push(@Body() dto: { userId: string; title: string; body: string }) {
    return this.notificationService.sendPush(dto);
  }
}
