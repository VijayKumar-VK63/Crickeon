import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { RedisClientFactory } from '@crickeon/infra-redis/redis.client';
import { RedisLockService } from '@crickeon/infra-locks/redis-lock.service';

@Injectable()
export class AuctionLockService implements OnModuleDestroy {
  private readonly redis = RedisClientFactory.createClient();
  private readonly lockService = new RedisLockService(this.redis);

  async runWithAuctionLock<T>(auctionId: string, work: () => Promise<T>, ttlMs = 2500): Promise<T> {
    const resource = `auction:${auctionId}`;
    await this.lockService.acquireLock(resource, ttlMs, 10, 20);
    try {
      return await work();
    } finally {
      await this.lockService.releaseLock(resource);
    }
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
