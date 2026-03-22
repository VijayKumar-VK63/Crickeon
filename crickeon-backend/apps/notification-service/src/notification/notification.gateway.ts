import { OnGatewayConnection, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RedisClientFactory } from '@crickeon/infra-redis/redis.client';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/live' })
export class NotificationGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly subscriber = RedisClientFactory.createClient();

  async afterInit() {
    await this.subscriber.psubscribe('room:*:bid_updated', 'room:*:auction_timer', 'match:*:update');
    this.subscriber.on('pmessage', (_pattern, channel, rawPayload) => {
      const payload = JSON.parse(rawPayload) as Record<string, unknown>;
      if (channel.includes(':bid_updated')) {
        const roomId = channel.split(':')[1];
        this.server.to(roomId).emit('bid_updated', payload);
        return;
      }

      if (channel.includes(':auction_timer')) {
        const roomId = channel.split(':')[1];
        this.server.to(roomId).emit('auction_timer', payload);
        return;
      }

      if (channel.includes(':update')) {
        this.server.emit((payload.type as string) ?? 'match_update', payload);
      }
    });

    this.server.emit('system', { status: 'ready' });
  }

  handleConnection(client: Socket) {
    client.emit('connected', { id: client.id });
  }

  @SubscribeMessage('subscribe_room')
  subscribeRoom(client: Socket, payload: { roomId: string }) {
    client.join(payload.roomId);
    client.emit('subscribed', payload);
  }

  publishRoomEvent(roomId: string, event: string, payload: unknown) {
    this.server.to(roomId).emit(event, payload);
  }
}
