import Redis from 'ioredis';

export class RedisClientFactory {
  static createClient(url?: string) {
    return new Redis(url ?? process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: false
    });
  }
}
