import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { RedisClientFactory } from '@crickeon/infra-redis/redis.client';
import { PubSubService } from '@crickeon/infra-redis/pubsub.service';

@Injectable()
export class MatchRealtimeService implements OnModuleDestroy {
  private readonly publisher = RedisClientFactory.createClient();
  private readonly subscriber = RedisClientFactory.createClient();
  private readonly cacheClient = RedisClientFactory.createClient();
  private readonly pubsub = new PubSubService(this.publisher, this.subscriber);

  async publishMatchUpdate(matchId: string, payload: Record<string, unknown>) {
    await this.pubsub.publish(`match:${matchId}:update`, payload);
  }

  async cacheMatchState(matchId: string, payload: Record<string, unknown>, ttlSeconds = 20) {
    await this.cacheClient.set(`match:state:${matchId}`, JSON.stringify(payload), 'EX', ttlSeconds);
  }

  async getCachedMatchState(matchId: string): Promise<Record<string, unknown> | null> {
    const value = await this.cacheClient.get(`match:state:${matchId}`);
    if (!value) return null;
    return JSON.parse(value) as Record<string, unknown>;
  }

  async onModuleDestroy() {
    await Promise.all([this.publisher.quit(), this.subscriber.quit(), this.cacheClient.quit()]);
  }
}
