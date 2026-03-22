import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { RedisClientFactory } from '@crickeon/infra-redis/redis.client';
import { PubSubService } from '@crickeon/infra-redis/pubsub.service';

@Injectable()
export class AuctionRealtimeService implements OnModuleDestroy {
  private readonly publisher = RedisClientFactory.createClient();
  private readonly subscriber = RedisClientFactory.createClient();
  private readonly cacheClient = RedisClientFactory.createClient();
  private readonly pubsub = new PubSubService(this.publisher, this.subscriber);

  async publishBidUpdated(roomId: string, payload: Record<string, unknown>) {
    await this.pubsub.publish(`room:${roomId}:bid_updated`, payload);
  }

  async publishAuctionTimer(roomId: string, payload: Record<string, unknown>) {
    await this.pubsub.publish(`room:${roomId}:auction_timer`, payload);
  }

  async cacheAuctionTimer(auctionId: string, remainingMs: number) {
    await this.cacheClient.set(`auction:timer:${auctionId}`, String(remainingMs), 'PX', Math.max(remainingMs, 1000));
  }

  async getAuctionTimer(auctionId: string): Promise<number | null> {
    const value = await this.cacheClient.get(`auction:timer:${auctionId}`);
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  async onModuleDestroy() {
    await Promise.all([this.publisher.quit(), this.subscriber.quit(), this.cacheClient.quit()]);
  }
}
